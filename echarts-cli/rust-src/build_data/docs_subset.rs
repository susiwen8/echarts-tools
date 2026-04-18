use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use serde::Serialize;
use serde_json::{Map, Value};

#[derive(Debug, Clone, PartialEq)]
pub struct OutlineEntry {
    pub type_field: Option<Value>,
    pub default: Value,
    pub is_object: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OutlineNode {
    #[serde(default)]
    prop: String,
    #[serde(default)]
    is_object: bool,
    #[serde(default, rename = "type")]
    type_field: Option<Value>,
    #[serde(default)]
    default: Option<Value>,
    #[serde(default)]
    children: Vec<OutlineNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct PackagedOptionEntry {
    path: String,
    description: Option<String>,
    #[serde(rename = "type")]
    type_field: Option<Value>,
    default: Value,
    is_object: bool,
    order: usize,
}

#[derive(Debug, Clone, PartialEq)]
struct PackagedOptionDoc {
    title: String,
    scope_root: Option<String>,
    entries: BTreeMap<String, PackagedOptionEntry>,
    content: String,
}

pub fn collect_referenced_option_doc_paths(metadata: &Value) -> Vec<String> {
    let mut paths = BTreeSet::new();

    for collection_name in ["items", "optionIndex"] {
        if let Some(collection) = metadata.get(collection_name).and_then(Value::as_array) {
            for item in collection {
                add_bundle_paths(
                    item.get("docs").and_then(|docs| docs.get("option")),
                    &mut paths,
                );
            }
        }
    }

    paths.into_iter().collect()
}

pub fn build_outline_entries(
    website_root: &Path,
    locale: &str,
    scope_root: &str,
) -> Result<BTreeMap<String, OutlineEntry>, String> {
    let outline_path = website_root
        .join(locale)
        .join("documents")
        .join("option-parts")
        .join("option-outline.json");
    let outline: OutlineNode = serde_json::from_str(
        &fs::read_to_string(&outline_path)
            .map_err(|error| format!("Failed to read {}: {error}", outline_path.display()))?,
    )
    .map_err(|error| format!("Failed to parse {}: {error}", outline_path.display()))?;

    let mut entries = BTreeMap::new();
    if let Some(scope_node) = find_scope_node(&outline, scope_root) {
        walk_outline(scope_node, &mut Vec::new(), &mut entries);
    }
    Ok(entries)
}

pub fn copy_docs_subset(
    metadata: &Value,
    website_root: Option<&Path>,
    destination_dir: &Path,
) -> Result<usize, String> {
    remove_dir_all_if_exists(destination_dir)?;
    let Some(website_root) = website_root else {
        return Ok(0);
    };

    let mut copied = 0usize;
    for relative_path in collect_referenced_option_doc_paths(metadata) {
        let source_path = join_relative(website_root, &relative_path);
        if !source_path.exists() {
            continue;
        }

        let locale = relative_path.split('/').next().unwrap_or_default();
        let scope_root = derive_scope_root(&relative_path);
        let outline_entries = build_outline_entries(website_root, locale, &scope_root)?;
        let reduced = render_option_json_doc(
            &relative_path,
            &fs::read_to_string(&source_path)
                .map_err(|error| format!("Failed to read {}: {error}", source_path.display()))?,
            &outline_entries,
        )?;
        let destination_path = join_relative(destination_dir, &relative_path);
        if let Some(parent) = destination_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Failed to create {}: {error}", parent.display()))?;
        }

        let mut output = Map::new();
        output.insert("title".to_string(), Value::String(reduced.title));
        output.insert(
            "scopeRoot".to_string(),
            reduced.scope_root.map(Value::String).unwrap_or(Value::Null),
        );
        output.insert(
            "entries".to_string(),
            serde_json::to_value(reduced.entries).map_err(|error| {
                format!("Failed to serialize entries for {relative_path}: {error}")
            })?,
        );

        fs::write(
            &destination_path,
            serde_json::to_string(&output).map_err(|error| {
                format!(
                    "Failed to serialize {}: {error}",
                    destination_path.display()
                )
            })?,
        )
        .map_err(|error| format!("Failed to write {}: {error}", destination_path.display()))?;
        copied += 1;
    }

    Ok(copied)
}

fn render_option_json_doc(
    relative_path: &str,
    source: &str,
    outline_entries: &BTreeMap<String, OutlineEntry>,
) -> Result<PackagedOptionDoc, String> {
    let parsed: Value = serde_json::from_str(source)
        .map_err(|error| format!("Failed to parse option doc {relative_path}: {error}"))?;
    let title = doc_title(relative_path, parsed.get("title").and_then(Value::as_str));
    let scope_root = parsed
        .get("scopeRoot")
        .and_then(Value::as_str)
        .map(|value| value.to_string())
        .or_else(|| Some(derive_scope_root(relative_path)));

    if let Some(entries) = parsed.get("entries").and_then(Value::as_object) {
        let existing_entries: BTreeMap<String, PackagedOptionEntry> =
            serde_json::from_value(Value::Object(entries.clone())).map_err(|error| {
                format!("Failed to parse existing entries for {relative_path}: {error}")
            })?;
        let content = parsed
            .get("content")
            .and_then(Value::as_str)
            .map(|value| value.to_string())
            .unwrap_or_else(|| build_option_doc_content(&title, &existing_entries));
        return Ok(PackagedOptionDoc {
            title,
            scope_root,
            entries: existing_entries,
            content,
        });
    }

    let raw_entries = parsed
        .as_object()
        .ok_or_else(|| format!("Option doc {relative_path} must be a JSON object"))?;

    let mut entries = BTreeMap::new();
    let mut order = 0usize;
    let mut lines = vec![format!("# {title}")];

    for (prop, entry) in raw_entries {
        lines.push(String::new());
        lines.push(format!("## {prop}"));

        let description = entry
            .get("desc")
            .and_then(Value::as_str)
            .map(html_to_text)
            .filter(|value| !value.is_empty());
        if let Some(value) = description.as_ref() {
            lines.push(value.clone());
        }
        let outline_entry = outline_entries.get(prop);
        order += 1;
        entries.insert(
            prop.clone(),
            PackagedOptionEntry {
                path: prop.clone(),
                description,
                type_field: outline_entry.and_then(|entry| entry.type_field.clone()),
                default: outline_entry
                    .map(|entry| entry.default.clone())
                    .unwrap_or_else(|| {
                        entry
                            .get("uiControl")
                            .and_then(|ui| ui.get("default"))
                            .cloned()
                            .unwrap_or(Value::Null)
                    }),
                is_object: outline_entry.map(|entry| entry.is_object).unwrap_or(false),
                order,
            },
        );
    }

    for (prop, outline_entry) in outline_entries {
        if entries.contains_key(prop) {
            continue;
        }

        order += 1;
        entries.insert(
            prop.clone(),
            PackagedOptionEntry {
                path: prop.clone(),
                description: None,
                type_field: outline_entry.type_field.clone(),
                default: outline_entry.default.clone(),
                is_object: outline_entry.is_object,
                order,
            },
        );
    }

    Ok(PackagedOptionDoc {
        title,
        scope_root,
        entries,
        content: lines.join("\n").trim().to_string(),
    })
}

fn add_bundle_paths(bundle: Option<&Value>, paths: &mut BTreeSet<String>) {
    let Some(bundle) = bundle else {
        return;
    };

    for locale in ["zh", "en"] {
        if let Some(relative_path) = bundle
            .get(locale)
            .and_then(|value| value.get("relativePath"))
            .and_then(Value::as_str)
        {
            if let Some(base_path) = relative_path.split('#').next() {
                if !base_path.is_empty() {
                    paths.insert(base_path.to_string());
                }
            }
        }
    }
}

fn doc_title(relative_path: &str, current: Option<&str>) -> String {
    current.map(|value| value.to_string()).unwrap_or_else(|| {
        Path::new(relative_path)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or(relative_path)
            .trim_end_matches(".json")
            .to_string()
    })
}

fn derive_scope_root(relative_path: &str) -> String {
    let base_name = Path::new(relative_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(relative_path)
        .trim_end_matches(".json")
        .trim_start_matches("option.");
    if base_name.starts_with("series-") {
        "series".to_string()
    } else {
        base_name.to_string()
    }
}

fn find_scope_node<'a>(node: &'a OutlineNode, scope_root: &str) -> Option<&'a OutlineNode> {
    if node.prop == scope_root && node.is_object {
        return Some(node);
    }

    for child in &node.children {
        if let Some(found) = find_scope_node(child, scope_root) {
            return Some(found);
        }
    }
    None
}

fn walk_outline(
    node: &OutlineNode,
    prefix_parts: &mut Vec<String>,
    entries: &mut BTreeMap<String, OutlineEntry>,
) {
    for child in &node.children {
        prefix_parts.push(child.prop.clone());
        let child_path = prefix_parts.join(".");
        entries.insert(
            child_path,
            OutlineEntry {
                type_field: child.type_field.clone(),
                default: child.default.clone().unwrap_or(Value::Null),
                is_object: child.is_object,
            },
        );
        walk_outline(child, prefix_parts, entries);
        prefix_parts.pop();
    }
}

fn build_option_doc_content(
    title: &str,
    entries: &BTreeMap<String, PackagedOptionEntry>,
) -> String {
    let mut ordered = entries.values().cloned().collect::<Vec<_>>();
    ordered.sort_by(|left, right| {
        left.order
            .cmp(&right.order)
            .then(left.path.cmp(&right.path))
    });

    let mut lines = vec![format!("# {title}")];
    for entry in ordered {
        lines.push(String::new());
        lines.push(format!("## {}", entry.path));
        if let Some(description) = entry.description {
            lines.push(description);
        }
    }

    lines.join("\n").trim().to_string()
}

fn html_to_text(value: &str) -> String {
    let mut text = value
        .replace("<li>", "\n- ")
        .replace("</li>", "\n")
        .replace("</p>", "\n\n");
    text = replace_br_tags(&text);
    text = replace_pre_code_blocks(&text);
    text = decode_html_entities(&strip_tags(&text));
    normalize_whitespace(&text)
}

fn replace_br_tags(value: &str) -> String {
    let mut result = value.to_string();
    for pattern in ["<br>", "<br/>", "<br />"] {
        result = result.replace(pattern, "\n");
    }
    result
}

fn replace_pre_code_blocks(value: &str) -> String {
    let mut remaining = value;
    let mut result = String::new();

    while let Some(start) = remaining.find("<pre><code") {
        result.push_str(&remaining[..start]);
        let after_start = &remaining[start..];
        let tag_end = match after_start.find('>') {
            Some(index) => index + 1,
            None => {
                result.push_str(after_start);
                return result;
            }
        };
        let after_tag = &after_start[tag_end..];
        let end = match after_tag.find("</code></pre>") {
            Some(index) => index,
            None => {
                result.push_str(after_start);
                return result;
            }
        };
        result.push_str("\n```\n");
        result.push_str(&after_tag[..end]);
        result.push_str("\n```\n");
        remaining = &after_tag[end + "</code></pre>".len()..];
    }

    result.push_str(remaining);
    result
}

fn strip_tags(value: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;

    for ch in value.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                result.push(' ');
            }
            _ if !in_tag => result.push(ch),
            _ => {}
        }
    }

    result
}

fn decode_html_entities(value: &str) -> String {
    value
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

fn normalize_whitespace(value: &str) -> String {
    let mut result = String::new();
    let mut last_was_space = false;
    let mut newline_run = 0usize;

    for ch in value.chars() {
        match ch {
            '\n' => {
                while result.ends_with(' ') || result.ends_with('\t') {
                    result.pop();
                }
                newline_run += 1;
                if newline_run <= 2 {
                    result.push('\n');
                }
                last_was_space = false;
            }
            '\t' | ' ' => {
                newline_run = 0;
                if !last_was_space {
                    result.push(' ');
                    last_was_space = true;
                }
            }
            _ => {
                newline_run = 0;
                result.push(ch);
                last_was_space = false;
            }
        }
    }

    result
        .lines()
        .map(str::trim)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn join_relative(root: &Path, relative_path: &str) -> PathBuf {
    relative_path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .fold(root.to_path_buf(), |path, segment| path.join(segment))
}

fn remove_dir_all_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_dir_all(path)
            .map_err(|error| format!("Failed to remove {}: {error}", path.display()))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    use serde_json::json;
    use serde_json::Value;

    use super::{build_outline_entries, collect_referenced_option_doc_paths, copy_docs_subset};

    #[test]
    fn collects_referenced_option_doc_paths_sorted_and_without_fragments() {
        let metadata = json!({
            "items": [
                {
                    "docs": {
                        "option": {
                            "zh": { "relativePath": "zh/documents/option-parts/option.series-line.json#smooth" },
                            "en": { "relativePath": "en/documents/option-parts/option.series-line.json" }
                        }
                    }
                }
            ],
            "optionIndex": [
                {
                    "docs": {
                        "option": {
                            "zh": { "relativePath": "zh/documents/option-parts/option.radar.json" },
                            "en": { "relativePath": "en/documents/option-parts/option.series-line.json#width" }
                        }
                    }
                }
            ]
        });

        assert_eq!(
            collect_referenced_option_doc_paths(&metadata),
            vec![
                "en/documents/option-parts/option.series-line.json".to_string(),
                "zh/documents/option-parts/option.radar.json".to_string(),
                "zh/documents/option-parts/option.series-line.json".to_string(),
            ]
        );
    }

    #[test]
    fn builds_outline_entries_for_nested_scope_children() {
        let root = temp_dir("outline");
        let outline_path = root.join("zh").join("documents").join("option-parts");
        fs::create_dir_all(&outline_path).unwrap();
        fs::write(
            outline_path.join("option-outline.json"),
            serde_json::to_string(&json!({
                "prop": "option",
                "isObject": true,
                "children": [
                    {
                        "prop": "series",
                        "isObject": true,
                        "children": [
                            { "prop": "smooth", "type": "boolean", "default": false },
                            {
                                "prop": "lineStyle",
                                "type": "Object",
                                "isObject": true,
                                "children": [
                                    { "prop": "width", "type": "number", "default": 2 }
                                ]
                            }
                        ]
                    }
                ]
            }))
            .unwrap(),
        )
        .unwrap();

        let entries = build_outline_entries(&root, "zh", "series").unwrap();
        assert_eq!(entries.get("smooth").unwrap().default, Value::Bool(false));
        assert_eq!(
            entries.get("lineStyle").unwrap().type_field,
            Some(Value::String("Object".to_string()))
        );
        assert_eq!(
            entries.get("lineStyle.width").unwrap().default,
            Value::from(2)
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn copies_reduced_docs_subset_and_clears_previous_output() {
        let root = temp_dir("copy-docs");
        let website_root = root.join("website");
        let destination_dir = root.join("out");
        fs::create_dir_all(destination_dir.join("stale")).unwrap();
        fs::write(destination_dir.join("stale/old.json"), "{}").unwrap();

        for locale in ["zh", "en"] {
            let option_parts = website_root
                .join(locale)
                .join("documents")
                .join("option-parts");
            fs::create_dir_all(&option_parts).unwrap();
            fs::write(
                option_parts.join("option-outline.json"),
                serde_json::to_string(&json!({
                    "prop": "option",
                    "isObject": true,
                    "children": [
                        {
                            "prop": "series",
                            "isObject": true,
                            "children": [
                                { "prop": "smooth", "type": "boolean", "default": false },
                                {
                                    "prop": "lineStyle",
                                    "type": "Object",
                                    "isObject": true,
                                    "children": [
                                        { "prop": "width", "type": "number", "default": 2 }
                                    ]
                                }
                            ]
                        }
                    ]
                }))
                .unwrap(),
            )
            .unwrap();
            fs::write(
                option_parts.join("option.series-line.json"),
                serde_json::to_string(&json!({
                    "smooth": { "desc": "<p>Smooth &amp; fast</p>", "uiControl": { "default": true } }
                }))
                .unwrap(),
            )
            .unwrap();
        }

        let metadata = json!({
            "items": [
                {
                    "docs": {
                        "option": {
                            "zh": { "relativePath": "zh/documents/option-parts/option.series-line.json" },
                            "en": { "relativePath": "en/documents/option-parts/option.series-line.json" }
                        }
                    }
                }
            ]
        });

        let copied = copy_docs_subset(&metadata, Some(&website_root), &destination_dir).unwrap();
        assert_eq!(copied, 2);
        assert!(!destination_dir.join("stale/old.json").exists());

        let zh_output: Value = serde_json::from_str(
            &fs::read_to_string(
                destination_dir.join("zh/documents/option-parts/option.series-line.json"),
            )
            .unwrap(),
        )
        .unwrap();
        assert_eq!(
            zh_output.get("scopeRoot"),
            Some(&Value::String("series".to_string()))
        );
        assert!(zh_output.get("content").is_none());
        assert_eq!(
            zh_output.pointer("/entries/smooth/description"),
            Some(&Value::String("Smooth & fast".to_string()))
        );
        assert_eq!(
            zh_output.pointer("/entries/smooth/type"),
            Some(&Value::String("boolean".to_string()))
        );
        assert_eq!(
            zh_output.pointer("/entries/smooth/default"),
            Some(&Value::Bool(false))
        );
        assert_eq!(
            zh_output.pointer("/entries/lineStyle.width/default"),
            Some(&Value::from(2))
        );

        fs::remove_dir_all(root).unwrap();
    }

    fn temp_dir(label: &str) -> PathBuf {
        let path = env::temp_dir().join(format!(
            "echarts-cli-build-data-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
