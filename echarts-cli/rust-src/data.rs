use std::cmp::Ordering;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::sync::{Arc, Mutex, OnceLock};

use crate::doc_utils::render_option_json_doc;
use crate::models::{
    DocRef, DocsBundle, ExampleRef, Item, LoadedOptionDoc, Metadata, OptionEntry, OptionIndexItem,
    OptionQueryPayload, OptionResultItem, QueryDocPayload, RelatedDocItem,
};
use crate::shared::{normalize_name, package_root, resolve_website_root};

static PACKAGE_ROOT_CACHE: OnceLock<Result<std::path::PathBuf, String>> = OnceLock::new();
static METADATA_CACHE: OnceLock<Result<Metadata, String>> = OnceLock::new();
static OPTION_DOC_CACHE: OnceLock<
    Mutex<HashMap<String, Result<Option<Arc<LoadedOptionDoc>>, String>>>,
> = OnceLock::new();

pub fn load_metadata() -> Result<Metadata, String> {
    metadata_cache()
}

pub fn package_root_cached() -> Result<std::path::PathBuf, String> {
    Ok(PACKAGE_ROOT_CACHE
        .get_or_init(package_root)
        .as_ref()
        .map_err(Clone::clone)?
        .clone())
}

pub fn resolve_item(query: &str) -> Result<Option<Item>, String> {
    let metadata = load_metadata()?;
    let normalized_query = normalize_name(query);
    Ok(metadata.items.into_iter().find(|item| {
        normalize_name(&item.name) == normalized_query
            || normalize_name(&item.export_name) == normalized_query
    }))
}

pub fn find_examples(query: &str) -> Result<Vec<ExampleRef>, String> {
    let metadata = load_metadata()?;
    let normalized_query = normalize_name(query);
    let mut ranked = metadata
        .examples
        .into_iter()
        .filter_map(|example| {
            let normalized_id = normalize_name(&example.id);
            let score = if normalized_id == normalized_query {
                100
            } else if normalized_id.starts_with(&normalized_query) {
                80
            } else if normalized_id.contains(&normalized_query) {
                50
            } else {
                0
            };

            if score > 0 {
                Some((score, example))
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    ranked.sort_by(|left, right| match right.0.cmp(&left.0) {
        Ordering::Equal => left.1.file.cmp(&right.1.file),
        other => other,
    });

    Ok(ranked.into_iter().map(|(_, example)| example).collect())
}

pub fn load_example_content(example: &ExampleRef) -> Result<Option<String>, String> {
    if let Some(content) = &example.content {
        return Ok(Some(content.clone()));
    }

    if let Some(content_path) = &example.content_path {
        let packaged_content_path = package_root_cached()?.join("data").join(content_path);
        if packaged_content_path.exists() {
            return fs::read_to_string(&packaged_content_path)
                .map(Some)
                .map_err(|error| {
                    format!(
                        "Failed to read {}: {error}",
                        packaged_content_path.display()
                    )
                });
        }
    }

    Ok(None)
}

pub fn docs_or_default(docs: Option<DocsBundle>) -> DocsBundle {
    docs.unwrap_or_default()
}

pub fn resolve_top_level_option(name: &str) -> Result<Option<OptionIndexItem>, String> {
    let metadata = load_metadata()?;
    let normalized_query = normalize_name(name);
    Ok(metadata
        .option_index
        .into_iter()
        .find(|option| normalize_name(&option.name) == normalized_query))
}

pub fn load_option_doc(
    bundle: Option<&crate::models::LocalizedDocs>,
    lang: &str,
) -> Result<Option<LoadedOptionDoc>, String> {
    let localized = match resolve_localized_doc(bundle, lang) {
        Some(localized) => localized,
        None => return Ok(None),
    };
    load_option_doc_from_ref(&localized)
}

pub fn load_option_doc_from_query_doc(doc: &QueryDocPayload) -> Result<LoadedOptionDoc, String> {
    load_option_doc_from_ref(&DocRef {
        relative_path: doc.relative_path.clone(),
        title: doc.title.clone(),
        summary: None,
    })?
    .ok_or_else(|| format!("Unable to load option doc: {}", doc.relative_path))
}

fn load_option_doc_from_ref(localized: &DocRef) -> Result<Option<LoadedOptionDoc>, String> {
    let cache = OPTION_DOC_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    let cache_key = localized.relative_path.clone();

    let cached = {
        let guard = cache
            .lock()
            .map_err(|_| "Option doc cache mutex poisoned".to_string())?;
        guard.get(&cache_key).cloned()
    };

    if let Some(cached) = cached {
        return cached.map(|doc| doc.map(|doc| (*doc).clone()));
    }

    let loaded = load_option_doc_uncached(localized).map(|doc| doc.map(Arc::new));
    let stored = loaded.clone();
    cache
        .lock()
        .map_err(|_| "Option doc cache mutex poisoned".to_string())?
        .insert(cache_key, stored);

    loaded.map(|doc| doc.map(|doc| (*doc).clone()))
}

pub fn resolve_fine_option_query(
    query: &[String],
    lang: &str,
) -> Result<Option<OptionQueryPayload>, String> {
    let segments = if query.len() == 1 && query[0].contains('.') {
        query[0]
            .split('.')
            .filter(|segment| !segment.is_empty())
            .map(|segment| segment.to_string())
            .collect::<Vec<_>>()
    } else {
        query
            .iter()
            .filter(|segment| !segment.is_empty())
            .cloned()
            .collect::<Vec<_>>()
    };

    let query_text = query.join(" ");
    if segments.len() < 2 {
        return Ok(None);
    }

    if let Some(item) = resolve_item(&segments[0])? {
        let context_name = item.name.clone();
        let item_doc = load_option_doc(
            item.docs.as_ref().and_then(|docs| docs.option.as_ref()),
            lang,
        )?;
        let remainder = segments[1..].join(".");
        let broad_tokens = segments[1..].to_vec();

        if let Some(item_doc) = &item_doc {
            if get_entry(item_doc, &remainder).is_some() {
                return Ok(Some(build_query_payload(
                    &query_text,
                    item_doc,
                    Some(remainder),
                    Some(context_name.clone()),
                )));
            }
        }

        if is_option_doc_key(&segments[1])? {
            if let Some(option) = resolve_top_level_option(&segments[1])? {
                if let Some(option_doc) = load_option_doc(
                    option.docs.as_ref().and_then(|docs| docs.option.as_ref()),
                    lang,
                )? {
                    let nested_path = if segments.len() > 2 {
                        Some(segments[2..].join("."))
                    } else {
                        None
                    };

                    if nested_path.as_deref().unwrap_or_default().is_empty() {
                        return Ok(Some(build_query_payload(
                            &query_text,
                            &option_doc,
                            None,
                            Some(context_name.clone()),
                        )));
                    }

                    let exact_path =
                        canonicalize_doc_path(&option_doc, nested_path.as_deref().unwrap());
                    if get_entry(&option_doc, &exact_path).is_some()
                        || !list_entry_children(&option_doc, Some(&exact_path)).is_empty()
                    {
                        return Ok(Some(build_query_payload(
                            &query_text,
                            &option_doc,
                            Some(exact_path),
                            Some(context_name.clone()),
                        )));
                    }

                    let results = search_entries(&option_doc, &segments[2..], None);
                    if !results.is_empty() {
                        return Ok(Some(build_search_payload(
                            &query_text,
                            &option_doc,
                            segments[2..].to_vec(),
                            results,
                            Some(context_name.clone()),
                        )));
                    }
                }
            }
            return Ok(None);
        }

        if broad_tokens.len() == 1 {
            let related_docs =
                search_related_option_docs(&broad_tokens, lang, Some(context_name.clone()))?;
            if !related_docs.is_empty() {
                return Ok(Some(build_related_docs_payload(
                    &query_text,
                    related_docs,
                    Some(context_name.clone()),
                )));
            }
        }

        if let Some(item_doc) = item_doc {
            let exact_path = canonicalize_doc_path(&item_doc, &remainder);
            if get_entry(&item_doc, &exact_path).is_some()
                || !list_entry_children(&item_doc, Some(&exact_path)).is_empty()
            {
                return Ok(Some(build_query_payload(
                    &query_text,
                    &item_doc,
                    Some(exact_path),
                    Some(context_name.clone()),
                )));
            }

            let results = search_entries(&item_doc, &segments[1..], None);
            if !results.is_empty() {
                return Ok(Some(build_search_payload(
                    &query_text,
                    &item_doc,
                    segments[1..].to_vec(),
                    results,
                    Some(context_name),
                )));
            }
        }

        return Ok(None);
    }

    let option = match resolve_top_level_option(&segments[0])? {
        Some(option) => option,
        None => {
            let related_docs = search_related_option_docs(&segments, lang, None)?;
            if !related_docs.is_empty() {
                return Ok(Some(build_related_docs_payload(
                    &query_text,
                    related_docs,
                    None,
                )));
            }
            return Ok(None);
        }
    };

    let option_doc = match load_option_doc(
        option.docs.as_ref().and_then(|docs| docs.option.as_ref()),
        lang,
    )? {
        Some(option_doc) => option_doc,
        None => return Ok(None),
    };

    let nested_path = canonicalize_doc_path(&option_doc, &segments[1..].join("."));
    if get_entry(&option_doc, &nested_path).is_some()
        || !list_entry_children(&option_doc, Some(&nested_path)).is_empty()
    {
        return Ok(Some(build_query_payload(
            &query_text,
            &option_doc,
            Some(nested_path),
            None,
        )));
    }

    let results = search_entries(&option_doc, &segments[1..], None);
    if !results.is_empty() {
        return Ok(Some(build_search_payload(
            &query_text,
            &option_doc,
            segments[1..].to_vec(),
            results,
            None,
        )));
    }

    Ok(None)
}

fn resolve_localized_doc(
    bundle: Option<&crate::models::LocalizedDocs>,
    lang: &str,
) -> Option<DocRef> {
    let bundle = bundle?;
    if lang == "en" {
        bundle.en.clone().or_else(|| bundle.zh.clone())
    } else {
        bundle.zh.clone().or_else(|| bundle.en.clone())
    }
}

fn is_option_doc_key(name: &str) -> Result<bool, String> {
    Ok(resolve_top_level_option(name)?.is_some())
}

fn get_entry(doc: &LoadedOptionDoc, prop_path: &str) -> Option<OptionEntry> {
    doc.entries.get(prop_path).cloned()
}

fn canonicalize_doc_path(doc: &LoadedOptionDoc, prop_path: &str) -> String {
    if prop_path.is_empty() || doc.entries.contains_key(prop_path) {
        return prop_path.to_string();
    }

    if let Some(scope_root) = &doc.scope_root {
        let scoped_path = format!("{scope_root}.{prop_path}");
        if doc.entries.contains_key(&scoped_path)
            || doc
                .entries
                .keys()
                .any(|path| path.starts_with(&format!("{scoped_path}.")))
        {
            return scoped_path;
        }
    }

    prop_path.to_string()
}

fn list_entry_children(doc: &LoadedOptionDoc, prop_path: Option<&str>) -> Vec<OptionResultItem> {
    build_option_doc_index(doc).children_for(prop_path)
}

fn score_entry_for_tokens(path_value: &str, tokens: &[String]) -> Option<i64> {
    let normalized_path = normalize_name(path_value);
    let normalized_segments = path_value
        .split('.')
        .map(normalize_name)
        .collect::<Vec<_>>();
    let mut score = 0_i64;

    for token in tokens {
        let normalized_token = normalize_name(token);
        if normalized_token.is_empty() {
            continue;
        }

        if normalized_segments.contains(&normalized_token) {
            score += 80;
            continue;
        }
        if normalized_segments
            .iter()
            .any(|segment| segment.starts_with(&normalized_token))
        {
            score += 50;
            continue;
        }
        if normalized_segments
            .iter()
            .any(|segment| segment.contains(&normalized_token))
        {
            score += 30;
            continue;
        }
        if normalized_path.contains(&normalized_token) {
            score += 10;
            continue;
        }

        return None;
    }

    score -= path_value.split('.').count() as i64;
    Some(score)
}

fn search_entries(
    doc: &LoadedOptionDoc,
    tokens: &[String],
    base_path: Option<&str>,
) -> Vec<OptionResultItem> {
    if tokens.is_empty() {
        return Vec::new();
    }

    let prefix = base_path.map(|path| format!("{path}.")).unwrap_or_default();
    let index = build_option_doc_index(doc);
    let mut results = Vec::new();

    for entry in doc.entries.values() {
        if let Some(base_path) = base_path {
            if entry.path != base_path && !entry.path.starts_with(&prefix) {
                continue;
            }
        }

        let score = match score_entry_for_tokens(&entry.path, tokens) {
            Some(score) => score,
            None => continue,
        };

        results.push(OptionResultItem {
            path: entry.path.clone(),
            description: entry.description.clone(),
            type_field: entry.type_field.clone(),
            default: entry.default.clone(),
            is_object: entry.is_object,
            order: entry.order,
            name: entry
                .path
                .split('.')
                .last()
                .unwrap_or(&entry.path)
                .to_string(),
            has_children: index.has_children(&entry.path),
            score: Some(score),
        });
    }

    results.sort_by(|left, right| {
        right
            .score
            .unwrap_or_default()
            .cmp(&left.score.unwrap_or_default())
            .then(left.order.cmp(&right.order))
            .then(
                left.path
                    .matches('.')
                    .count()
                    .cmp(&right.path.matches('.').count()),
            )
            .then(left.path.cmp(&right.path))
    });
    results
}

pub fn build_option_results(
    doc: &LoadedOptionDoc,
    prop_path: Option<&str>,
) -> Vec<OptionResultItem> {
    let index = build_option_doc_index(doc);
    let mut results = Vec::new();
    let mut seen = HashSet::new();

    if let Some(prop_path) = prop_path {
        if let Some(entry) = get_entry(doc, prop_path) {
            let item = index.entry_to_result(
                entry,
                prop_path.split('.').last().unwrap_or(prop_path).to_string(),
            );
            seen.insert(item.path.clone());
            results.push(item);
        }
    }

    for item in index.children_for(prop_path) {
        if seen.insert(item.path.clone()) {
            results.push(item);
        }
    }
    for item in index.descendants_for(prop_path) {
        if seen.insert(item.path.clone()) {
            results.push(item);
        }
    }
    results
}

fn metadata_cache() -> Result<Metadata, String> {
    Ok(METADATA_CACHE
        .get_or_init(load_metadata_uncached)
        .as_ref()
        .map_err(Clone::clone)?
        .clone())
}

fn load_metadata_uncached() -> Result<Metadata, String> {
    let package_root = package_root_cached()?;
    let metadata_path = package_root.join("data").join("metadata.json");
    if metadata_path.exists() {
        let source = fs::read_to_string(&metadata_path)
            .map_err(|error| format!("Failed to read {}: {error}", metadata_path.display()))?;
        return serde_json::from_str(&source)
            .map_err(|error| format!("Failed to parse {}: {error}", metadata_path.display()));
    }

    Err("Packaged metadata.json is required; source-repository fallback is intentionally unsupported.".to_string())
}

fn load_option_doc_uncached(localized: &DocRef) -> Result<Option<LoadedOptionDoc>, String> {
    let package_root = package_root_cached()?;
    let packaged_docs_path = package_root
        .join("data")
        .join("docs")
        .join(&localized.relative_path);
    let source = if packaged_docs_path.exists() {
        fs::read_to_string(&packaged_docs_path)
            .map_err(|error| format!("Failed to read {}: {error}", packaged_docs_path.display()))?
    } else if let Some(website_root) = resolve_website_root(Some(package_root.as_path())) {
        let website_doc_path = website_root.join(&localized.relative_path);
        if website_doc_path.exists() {
            fs::read_to_string(&website_doc_path).map_err(|error| {
                format!("Failed to read {}: {error}", website_doc_path.display())
            })?
        } else {
            return Ok(Some(empty_option_doc(localized)));
        }
    } else {
        return Ok(Some(empty_option_doc(localized)));
    };

    let rendered = render_option_json_doc(&localized.relative_path, &source)?;

    Ok(Some(LoadedOptionDoc {
        lang: option_doc_lang(&localized.relative_path).to_string(),
        relative_path: localized.relative_path.clone(),
        title: rendered.title.unwrap_or_else(|| localized.title.clone()),
        summary: localized.summary.clone(),
        scope_root: rendered.scope_root,
        entries: rendered.entries,
        content: rendered.content,
    }))
}

fn empty_option_doc(localized: &DocRef) -> LoadedOptionDoc {
    LoadedOptionDoc {
        lang: option_doc_lang(&localized.relative_path).to_string(),
        relative_path: localized.relative_path.clone(),
        title: localized.title.clone(),
        summary: localized.summary.clone(),
        scope_root: None,
        entries: BTreeMap::new(),
        content: None,
    }
}

fn option_doc_lang(relative_path: &str) -> &str {
    if relative_path.starts_with("en/") {
        "en"
    } else {
        "zh"
    }
}

#[derive(Debug)]
struct OptionDocIndex {
    children: HashMap<Option<String>, Vec<OptionResultItem>>,
    descendants: HashMap<Option<String>, Vec<OptionResultItem>>,
    has_children: HashMap<String, bool>,
}

impl OptionDocIndex {
    fn children_for(&self, prop_path: Option<&str>) -> Vec<OptionResultItem> {
        self.children
            .get(&prop_path.map(str::to_string))
            .cloned()
            .unwrap_or_default()
    }

    fn descendants_for(&self, prop_path: Option<&str>) -> Vec<OptionResultItem> {
        self.descendants
            .get(&prop_path.map(str::to_string))
            .cloned()
            .unwrap_or_default()
    }

    fn has_children(&self, path: &str) -> bool {
        self.has_children.get(path).copied().unwrap_or(false)
    }

    fn entry_to_result(&self, entry: OptionEntry, name: String) -> OptionResultItem {
        OptionResultItem {
            path: entry.path.clone(),
            description: entry.description,
            type_field: entry.type_field,
            default: entry.default,
            is_object: entry.is_object || self.has_children(&entry.path),
            order: entry.order,
            name,
            has_children: self.has_children(&entry.path),
            score: None,
        }
    }
}

fn build_option_doc_index(doc: &LoadedOptionDoc) -> OptionDocIndex {
    let mut direct_children: HashMap<Option<String>, HashMap<String, OptionResultItem>> =
        HashMap::new();
    let mut descendants: HashMap<Option<String>, Vec<OptionResultItem>> = HashMap::new();
    let mut has_children: HashMap<String, bool> = HashMap::new();

    for (path_key, entry) in &doc.entries {
        let segments = path_key.split('.').collect::<Vec<_>>();
        let name = segments.last().unwrap_or(&path_key.as_str()).to_string();

        for depth in 0..segments.len() {
            let ancestor = if depth == 0 {
                None
            } else {
                Some(segments[..depth].join("."))
            };

            let descendant_item = OptionResultItem {
                path: entry.path.clone(),
                description: entry.description.clone(),
                type_field: entry.type_field.clone(),
                default: entry.default.clone(),
                is_object: entry.is_object,
                order: entry.order,
                name: name.clone(),
                has_children: false,
                score: None,
            };
            descendants
                .entry(ancestor.clone())
                .or_default()
                .push(descendant_item);

            let child_name = segments[depth].to_string();
            let child_path = match &ancestor {
                Some(parent) => format!("{parent}.{child_name}"),
                None => child_name.clone(),
            };

            let child_entry = doc
                .entries
                .get(&child_path)
                .cloned()
                .unwrap_or(OptionEntry {
                    path: child_path.clone(),
                    description: None,
                    type_field: None,
                    default: None,
                    is_object: true,
                    order: entry.order,
                });

            let child = direct_children
                .entry(ancestor.clone())
                .or_default()
                .entry(child_path.clone())
                .or_insert_with(|| OptionResultItem {
                    path: child_entry.path.clone(),
                    description: child_entry.description.clone(),
                    type_field: child_entry.type_field.clone(),
                    default: child_entry.default.clone(),
                    is_object: child_entry.is_object,
                    order: child_entry.order,
                    name: child_name,
                    has_children: false,
                    score: None,
                });

            if depth + 1 < segments.len() {
                child.has_children = true;
                child.is_object = true;
                has_children.insert(child_path, true);
            }
        }
    }

    let mut children = HashMap::new();
    for (key, values) in direct_children {
        let mut values = values.into_values().collect::<Vec<_>>();
        values.sort_by(|left, right| {
            left.order
                .cmp(&right.order)
                .then(left.path.cmp(&right.path))
        });
        children.insert(key, values);
    }

    for values in descendants.values_mut() {
        values.sort_by(|left, right| {
            left.order
                .cmp(&right.order)
                .then(left.path.cmp(&right.path))
        });
    }

    OptionDocIndex {
        children,
        descendants,
        has_children,
    }
}

fn search_related_option_docs(
    tokens: &[String],
    lang: &str,
    context_item: Option<String>,
) -> Result<Vec<RelatedDocItem>, String> {
    let metadata = load_metadata()?;
    let mut results = Vec::new();

    for option in metadata.option_index {
        let localized_doc = resolve_localized_doc(
            option.docs.as_ref().and_then(|docs| docs.option.as_ref()),
            lang,
        );
        let summary = localized_doc
            .as_ref()
            .and_then(|doc| doc.summary.clone())
            .unwrap_or_default();
        let normalized_name = normalize_name(&option.name);
        let mut score = 0_i64;
        let mut rejected = false;

        for token in tokens {
            let normalized_token = normalize_name(token);
            if normalized_token.is_empty() {
                continue;
            }

            if normalized_name == normalized_token {
                score += 120;
            } else if normalized_name.starts_with(&normalized_token) {
                score += 90;
            } else if normalized_name.contains(&normalized_token) {
                score += 60;
            } else if normalize_name(&summary).contains(&normalized_token) {
                score += 20;
            } else {
                rejected = true;
                break;
            }
        }

        if rejected {
            continue;
        }

        if context_item.is_some() && tokens.iter().any(|token| normalize_name(token) == "axis") {
            score += match option.name.as_str() {
                "xAxis" | "yAxis" => 35,
                "angleAxis" | "radiusAxis" => 20,
                "singleAxis" => 10,
                _ => 0,
            };
        }

        results.push(RelatedDocItem {
            name: option.name,
            option_type: option.raw_type,
            top_level_key: option.top_level_key,
            doc: localized_doc,
            summary: if summary.is_empty() {
                None
            } else {
                Some(summary)
            },
            score: Some(score),
        });
    }

    results.sort_by(|left, right| {
        right
            .score
            .unwrap_or_default()
            .cmp(&left.score.unwrap_or_default())
            .then(left.name.len().cmp(&right.name.len()))
            .then(left.name.cmp(&right.name))
    });
    results.truncate(8);
    Ok(results)
}

fn build_query_payload(
    query: &str,
    doc: &LoadedOptionDoc,
    prop_path: Option<String>,
    context_item: Option<String>,
) -> OptionQueryPayload {
    let normalized_path = prop_path.map(|path| canonicalize_doc_path(doc, &path));
    let entry = normalized_path
        .as_ref()
        .and_then(|path| get_entry(doc, path));
    let children = list_entry_children(doc, normalized_path.as_deref());

    OptionQueryPayload {
        query: query.to_string(),
        context_item,
        doc: Some(QueryDocPayload {
            lang: doc.lang.clone(),
            relative_path: doc.relative_path.clone(),
            title: doc.title.clone(),
            scope_root: doc.scope_root.clone(),
        }),
        path: normalized_path,
        entry,
        children: Some(children),
        search_tokens: None,
        results: None,
        related_docs: None,
        full_desc: None,
        view_mode: None,
    }
}

fn build_search_payload(
    query: &str,
    doc: &LoadedOptionDoc,
    tokens: Vec<String>,
    results: Vec<OptionResultItem>,
    context_item: Option<String>,
) -> OptionQueryPayload {
    OptionQueryPayload {
        query: query.to_string(),
        context_item,
        doc: Some(QueryDocPayload {
            lang: doc.lang.clone(),
            relative_path: doc.relative_path.clone(),
            title: doc.title.clone(),
            scope_root: doc.scope_root.clone(),
        }),
        path: None,
        entry: None,
        children: None,
        search_tokens: Some(tokens),
        results: Some(results),
        related_docs: None,
        full_desc: None,
        view_mode: None,
    }
}

fn build_related_docs_payload(
    query: &str,
    related_docs: Vec<RelatedDocItem>,
    context_item: Option<String>,
) -> OptionQueryPayload {
    OptionQueryPayload {
        query: query.to_string(),
        context_item,
        doc: None,
        path: None,
        entry: None,
        children: None,
        search_tokens: None,
        results: None,
        related_docs: Some(related_docs),
        full_desc: None,
        view_mode: None,
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_option_results, load_option_doc, resolve_top_level_option, LoadedOptionDoc,
        OptionEntry, OPTION_DOC_CACHE,
    };
    use crate::models::{LocalizedDocs, TypeField};
    use std::collections::BTreeMap;
    use std::collections::HashMap;
    use std::sync::Mutex;

    #[test]
    fn build_option_results_preserves_root_and_descendant_flags() {
        let doc = fixture_doc();
        let results = build_option_results(&doc, Some("axisLabel"));

        let paths = results
            .iter()
            .map(|item| item.path.as_str())
            .collect::<Vec<_>>();
        assert_eq!(
            paths,
            vec![
                "axisLabel",
                "axisLabel.rotate",
                "axisLabel.formatter",
                "axisLabel.rich",
                "axisLabel.rich.a",
            ]
        );

        assert!(results[0].has_children);
        assert!(!results[1].has_children);
        assert!(results[3].has_children);
        assert_eq!(results[3].name, "rich");
    }

    #[test]
    fn option_doc_cache_is_lazy_per_relative_path() {
        let option = resolve_top_level_option("xAxis")
            .expect("resolve xAxis")
            .expect("xAxis option");
        let localized = option
            .docs
            .as_ref()
            .and_then(|docs| docs.option.as_ref())
            .and_then(|docs| docs.zh.clone().or(docs.en.clone()))
            .expect("localized option doc");

        let cache = OPTION_DOC_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
        cache.lock().expect("cache lock").clear();

        let first = load_option_doc(
            Some(&LocalizedDocs {
                zh: Some(localized.clone()),
                en: None,
            }),
            "zh",
        )
        .expect("first load")
        .expect("doc");
        let first_cache_len = cache.lock().expect("cache lock").len();

        let second = load_option_doc(
            Some(&LocalizedDocs {
                zh: Some(localized.clone()),
                en: None,
            }),
            "zh",
        )
        .expect("second load")
        .expect("doc");
        let cache_guard = cache.lock().expect("cache lock");

        assert_eq!(first.relative_path, second.relative_path);
        assert_eq!(first.entries.len(), second.entries.len());
        assert_eq!(first_cache_len, 1);
        assert_eq!(cache_guard.len(), 1);
        assert!(cache_guard.contains_key(&localized.relative_path));
    }

    fn fixture_doc() -> LoadedOptionDoc {
        let mut entries = BTreeMap::new();
        entries.insert(
            "axisLabel".to_string(),
            OptionEntry {
                path: "axisLabel".to_string(),
                description: Some("Axis label config".to_string()),
                type_field: Some(TypeField::Single("Object".to_string())),
                default: None,
                is_object: true,
                order: 1,
            },
        );
        entries.insert(
            "axisLabel.rotate".to_string(),
            OptionEntry {
                path: "axisLabel.rotate".to_string(),
                description: Some("Rotation".to_string()),
                type_field: Some(TypeField::Single("number".to_string())),
                default: None,
                is_object: false,
                order: 2,
            },
        );
        entries.insert(
            "axisLabel.formatter".to_string(),
            OptionEntry {
                path: "axisLabel.formatter".to_string(),
                description: Some("Formatter".to_string()),
                type_field: Some(TypeField::Single("string".to_string())),
                default: None,
                is_object: false,
                order: 3,
            },
        );
        entries.insert(
            "axisLabel.rich.a".to_string(),
            OptionEntry {
                path: "axisLabel.rich.a".to_string(),
                description: Some("Rich text fragment".to_string()),
                type_field: Some(TypeField::Single("Object".to_string())),
                default: None,
                is_object: true,
                order: 4,
            },
        );

        LoadedOptionDoc {
            lang: "zh".to_string(),
            relative_path: "zh/documents/option-parts/option.xAxis.json".to_string(),
            title: "xAxis".to_string(),
            summary: None,
            scope_root: Some("xAxis".to_string()),
            entries,
            content: None,
        }
    }
}
