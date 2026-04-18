use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::build_data::utils::camel_to_kebab;

use serde::Deserialize;

#[derive(Debug, Clone, PartialEq)]
pub struct OptionRootMetaEntry {
    pub summary: Option<String>,
    pub type_field: Option<String>,
    pub default: Option<serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PerLocaleOptionRootMeta {
    pub zh: Option<OptionRootMetaEntry>,
    pub en: Option<OptionRootMetaEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocRef {
    pub relative_path: String,
    pub title: String,
    pub summary: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalizedDocBundle {
    pub zh: Option<DocRef>,
    pub en: Option<DocRef>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocsPayload {
    pub option: Option<LocalizedDocBundle>,
    pub tutorials: Vec<LocalizedDocBundle>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocMeta {
    pub title: Option<String>,
    pub summary: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct OptionRootFile {
    #[serde(default)]
    option: Option<OptionRootNode>,
}

#[derive(Debug, Deserialize, Default)]
struct OptionRootNode {
    #[serde(default)]
    properties: HashMap<String, OptionRootProperty>,
}

#[derive(Debug, Deserialize, Default)]
struct OptionRootProperty {
    #[serde(default)]
    description: Option<String>,
    #[serde(default, rename = "type")]
    type_field: Option<String>,
    #[serde(default)]
    default: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Default)]
pub struct TutorialIndexEntry {
    #[serde(default)]
    desc: Option<String>,
}

pub fn load_option_root_meta(
    website_root: &Path,
    locale: &str,
) -> Result<HashMap<String, OptionRootMetaEntry>, String> {
    let file_path = website_root
        .join(locale)
        .join("documents")
        .join("option.json");
    if !file_path.exists() {
        return Ok(HashMap::new());
    }

    let root: OptionRootFile = serde_json::from_str(
        &fs::read_to_string(&file_path)
            .map_err(|error| format!("Failed to read {}: {error}", file_path.display()))?,
    )
    .map_err(|error| format!("Failed to parse {}: {error}", file_path.display()))?;

    let mut meta = HashMap::new();
    for (name, entry) in root.option.unwrap_or_default().properties {
        meta.insert(
            name,
            OptionRootMetaEntry {
                summary: entry
                    .description
                    .as_deref()
                    .map(strip_html)
                    .filter(|value| !value.is_empty()),
                type_field: entry.type_field,
                default: entry.default,
            },
        );
    }

    Ok(meta)
}

pub fn parse_doc_meta(source: &str) -> DocMeta {
    let lines = source.lines().collect::<Vec<_>>();
    let title = lines
        .iter()
        .find_map(|line| parse_title_line(line.trim()))
        .map(strip_markdown)
        .filter(|value| !value.is_empty());

    let mut blocks = Vec::new();
    let mut code_fence = false;
    let mut ignored_tag_block: Option<String> = None;
    let mut ignored_template_block = false;
    let mut current_block = Vec::new();

    let flush_block = |current_block: &mut Vec<String>, blocks: &mut Vec<String>| {
        if current_block.is_empty() {
            return;
        }
        let cleaned = strip_markdown(&current_block.join(" "));
        if !cleaned.is_empty() {
            blocks.push(cleaned);
        }
        current_block.clear();
    };

    for raw_line in lines {
        let line = raw_line.trim();

        if line.starts_with("```") {
            code_fence = !code_fence;
            flush_block(&mut current_block, &mut blocks);
            continue;
        }

        if ignored_template_block {
            if line.contains("}}") {
                ignored_template_block = false;
            }
            continue;
        }

        if let Some(tag) = &ignored_tag_block {
            if line.starts_with(&format!("</{tag}")) {
                ignored_tag_block = None;
            }
            continue;
        }

        if code_fence || line.is_empty() {
            flush_block(&mut current_block, &mut blocks);
            continue;
        }

        if line.starts_with("{{") {
            flush_block(&mut current_block, &mut blocks);
            if !line.contains("}}") {
                ignored_template_block = true;
            }
            continue;
        }

        if is_heading_like(line) {
            flush_block(&mut current_block, &mut blocks);
            continue;
        }

        if let Some(tag) = ignored_tag_name(line) {
            flush_block(&mut current_block, &mut blocks);
            if !line.ends_with("/>") {
                ignored_tag_block = Some(tag);
            }
            continue;
        }

        current_block.push(line.to_string());
    }
    flush_block(&mut current_block, &mut blocks);

    let mut summary_parts = Vec::new();
    for block in blocks {
        if title.as_deref() == Some(block.as_str()) {
            continue;
        }
        summary_parts.push(block.clone());
        let summary_text = summary_parts.join(" ");
        let first_block = summary_parts
            .first()
            .map(|value| value.as_str())
            .unwrap_or("");
        let first_block_looks_complete =
            first_block.chars().count() >= 48 || ends_with_sentence(first_block);
        if summary_parts.len() >= 2
            || summary_text.chars().count() >= 160
            || first_block_looks_complete
        {
            break;
        }
    }

    let summary = summary_parts.join(" ").trim().to_string();
    DocMeta {
        title,
        summary: if summary.is_empty() || summary.starts_with("- Type:") {
            None
        } else {
            Some(summary)
        },
    }
}

pub fn create_doc_ref(
    website_root: &Path,
    locale: &str,
    relative_path: &str,
    override_meta: Option<&OptionRootMetaEntry>,
) -> Result<Option<DocRef>, String> {
    let absolute_path = website_root.join(locale).join(PathBuf::from(relative_path));
    if !absolute_path.exists() {
        return Ok(None);
    }

    let source = fs::read_to_string(&absolute_path)
        .map_err(|error| format!("Failed to read {}: {error}", absolute_path.display()))?;
    let meta = if relative_path.ends_with(".json") {
        DocMeta {
            title: Some(
                Path::new(relative_path)
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or(relative_path)
                    .trim_end_matches(".json")
                    .to_string(),
            ),
            summary: None,
        }
    } else {
        parse_doc_meta(&source)
    };

    Ok(Some(DocRef {
        relative_path: format!("{locale}/{relative_path}"),
        title: meta.title.unwrap_or_default(),
        summary: override_meta
            .and_then(|meta| meta.summary.clone())
            .or(meta.summary),
    }))
}

pub fn create_localized_doc_bundle(
    website_root: &Path,
    relative_path: &str,
    meta_by_locale: Option<&PerLocaleOptionRootMeta>,
) -> Result<Option<LocalizedDocBundle>, String> {
    let zh = create_doc_ref(
        website_root,
        "zh",
        relative_path,
        meta_by_locale.and_then(|value| value.zh.as_ref()),
    )?;
    let en = create_doc_ref(
        website_root,
        "en",
        relative_path,
        meta_by_locale.and_then(|value| value.en.as_ref()),
    )?;
    if zh.is_none() && en.is_none() {
        return Ok(None);
    }
    Ok(Some(LocalizedDocBundle { zh, en }))
}

pub fn resolve_option_doc_relative_path(kind: &str, name: &str) -> String {
    if let Some(path) = doc_option_hints().get(name) {
        return (*path).to_string();
    }
    if kind == "chart" {
        return format!("documents/option-parts/option.series-{name}.json");
    }
    format!(
        "documents/option-parts/option.{}.json",
        camel_to_kebab(name)
    )
}

fn load_tutorial_index(
    website_root: &Path,
    locale: &str,
) -> Result<Option<HashMap<String, TutorialIndexEntry>>, String> {
    let file_path = website_root
        .join(locale)
        .join("documents")
        .join("tutorial-parts")
        .join("tutorial.json");
    if !file_path.exists() {
        return Ok(None);
    }
    let value: HashMap<String, TutorialIndexEntry> = serde_json::from_str(
        &fs::read_to_string(&file_path)
            .map_err(|error| format!("Failed to read {}: {error}", file_path.display()))?,
    )
    .map_err(|error| format!("Failed to parse {}: {error}", file_path.display()))?;
    Ok(Some(value))
}

pub fn create_tutorial_ref(
    website_root: &Path,
    locale: &str,
    title: &str,
) -> Result<Option<DocRef>, String> {
    let index = match load_tutorial_index(website_root, locale)? {
        Some(index) => index,
        None => return Ok(None),
    };
    let entry = match index.get(title) {
        Some(entry) => entry,
        None => return Ok(None),
    };
    Ok(Some(DocRef {
        relative_path: format!(
            "{locale}/documents/tutorial-parts/tutorial.json#{}",
            url_encode(title)
        ),
        title: title.to_string(),
        summary: entry
            .desc
            .as_deref()
            .map(strip_html)
            .filter(|value| !value.is_empty()),
    }))
}

pub fn create_localized_tutorial_bundle(
    website_root: &Path,
    zh_title: &str,
    en_title: &str,
) -> Result<Option<LocalizedDocBundle>, String> {
    let zh = create_tutorial_ref(website_root, "zh", zh_title)?;
    let en = create_tutorial_ref(website_root, "en", en_title)?;
    if zh.is_none() && en.is_none() {
        return Ok(None);
    }
    Ok(Some(LocalizedDocBundle { zh, en }))
}

pub fn build_docs_payload(
    kind: &str,
    name: &str,
    website_root: Option<&Path>,
    option_root_meta: &HashMap<String, PerLocaleOptionRootMeta>,
) -> Result<DocsPayload, String> {
    let option = if let Some(website_root) = website_root {
        let option_doc_path = resolve_option_doc_relative_path(kind, name);
        create_localized_doc_bundle(website_root, &option_doc_path, option_root_meta.get(name))?
    } else {
        None
    };

    let mut tutorials = Vec::new();
    if let Some(website_root) = website_root {
        if let Some(hints) = tutorial_hints().get(name) {
            for (zh, en) in hints {
                if let Some(bundle) = create_localized_tutorial_bundle(website_root, zh, en)? {
                    tutorials.push(bundle);
                }
            }
        }
    }

    Ok(DocsPayload { option, tutorials })
}

fn strip_markdown(value: &str) -> String {
    collapse_whitespace(&strip_tags(&decode_html_entities(
        &remove_markdown_wrappers(&remove_template_blocks(value)),
    )))
}

fn strip_html(value: &str) -> String {
    collapse_whitespace(&decode_html_entities(&strip_tags(&remove_tag_blocks(
        value,
        &["pre", "code"],
    ))))
}

fn remove_template_blocks(value: &str) -> String {
    let mut result = String::new();
    let mut index = 0;
    while let Some(start) = value[index..].find("{{") {
        let abs_start = index + start;
        result.push_str(&value[index..abs_start]);
        if let Some(end) = value[abs_start + 2..].find("}}") {
            index = abs_start + 2 + end + 2;
        } else {
            index = value.len();
            break;
        }
    }
    result.push_str(&value[index..]);
    result
}

fn remove_markdown_wrappers(value: &str) -> String {
    let mut output = value.replace("&nbsp;", " ");
    while let Some(start) = output.find("![") {
        if let Some(close) = output[start..].find(')') {
            let alt_end = output[start + 2..]
                .find(']')
                .map(|idx| start + 2 + idx)
                .unwrap_or(start);
            let alt = output[start + 2..alt_end].to_string();
            output.replace_range(start..start + close + 1, &alt);
        } else {
            break;
        }
    }
    while let Some(start) = output.find('[') {
        let slice = &output[start..];
        if let (Some(mid), Some(end)) = (slice.find("]("), slice.find(')')) {
            let label = slice[1..mid].to_string();
            output.replace_range(start..start + end + 1, &label);
        } else {
            break;
        }
    }
    output = output.replace("**", "").replace('*', "");
    remove_inline_code(&output)
}

fn remove_inline_code(value: &str) -> String {
    let mut result = String::new();
    let mut in_code = false;
    for ch in value.chars() {
        if ch == '`' {
            in_code = !in_code;
            continue;
        }
        result.push(ch);
    }
    result
}

fn remove_tag_blocks(value: &str, tags: &[&str]) -> String {
    let mut output = value.to_string();
    for tag in tags {
        loop {
            let open = format!("<{tag}");
            let close = format!("</{tag}>");
            let start = match output.find(&open) {
                Some(start) => start,
                None => break,
            };
            let end = match output[start..].find(&close) {
                Some(end) => start + end + close.len(),
                None => break,
            };
            output.replace_range(start..end, " ");
        }
    }
    output
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

fn collapse_whitespace(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn is_heading_like(line: &str) -> bool {
    parse_heading_line(line).is_some() || line.starts_with("~[") || line.chars().all(|ch| ch == '-')
}

fn ignored_tag_name(line: &str) -> Option<String> {
    let candidates = [
        "ExampleBaseOption",
        "ExampleUIControlBoolean",
        "ExampleUIControlEnum",
        "ExampleUIControlNumber",
        "ExampleUIControl",
        "template",
        "script",
        "style",
    ];
    for candidate in candidates {
        if line.starts_with(&format!("<{candidate}")) {
            return Some(candidate.to_string());
        }
    }
    None
}

fn ends_with_sentence(value: &str) -> bool {
    matches!(
        value.chars().last(),
        Some('。' | '！' | '？' | '.' | '!' | '?')
    )
}

fn parse_title_line(line: &str) -> Option<&str> {
    parse_heading_line(line)
        .filter(|(level, _)| *level == 1)
        .map(|(_, text)| text)
}

fn parse_heading_line(line: &str) -> Option<(usize, &str)> {
    let hash_count = line.chars().take_while(|ch| *ch == '#').count();
    if hash_count == 0 {
        return None;
    }
    let rest = &line[hash_count..];
    if !rest.starts_with(char::is_whitespace) {
        return None;
    }
    Some((hash_count, rest.trim_start()))
}

fn url_encode(value: &str) -> String {
    let mut output = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                output.push(byte as char)
            }
            _ => output.push_str(&format!("%{:02X}", byte)),
        }
    }
    output
}

fn doc_option_hints() -> HashMap<&'static str, &'static str> {
    HashMap::from([
        (
            "axisPointer",
            "documents/option-parts/option.axisPointer.json",
        ),
        ("angleAxis", "documents/option-parts/option.angleAxis.json"),
        ("aria", "documents/option-parts/option.aria.json"),
        ("brush", "documents/option-parts/option.brush.json"),
        ("calendar", "documents/option-parts/option.calendar.json"),
        (
            "dataZoomInside",
            "documents/option-parts/option.dataZoom-inside.json",
        ),
        (
            "dataZoomSlider",
            "documents/option-parts/option.dataZoom-slider.json",
        ),
        ("dataset", "documents/option-parts/option.dataset.json"),
        ("geo", "documents/option-parts/option.geo.json"),
        ("graphic", "documents/option-parts/option.graphic.json"),
        ("grid", "documents/option-parts/option.grid.json"),
        ("gridSimple", "documents/option-parts/option.grid.json"),
        ("legend", "documents/option-parts/option.legend.json"),
        ("legendPlain", "documents/option-parts/option.legend.json"),
        ("legendScroll", "documents/option-parts/option.legend.json"),
        ("matrix", "documents/option-parts/option.matrix.json"),
        ("parallel", "documents/option-parts/option.parallel.json"),
        (
            "parallelAxis",
            "documents/option-parts/option.parallelAxis.json",
        ),
        ("polar", "documents/option-parts/option.polar.json"),
        ("radar", "documents/option-parts/option.radar.json"),
        (
            "radiusAxis",
            "documents/option-parts/option.radiusAxis.json",
        ),
        (
            "singleAxis",
            "documents/option-parts/option.singleAxis.json",
        ),
        ("textStyle", "documents/option-parts/option.textStyle.json"),
        ("thumbnail", "documents/option-parts/option.thumbnail.json"),
        ("timeline", "documents/option-parts/option.timeline.json"),
        ("title", "documents/option-parts/option.title.json"),
        ("toolbox", "documents/option-parts/option.toolbox.json"),
        ("tooltip", "documents/option-parts/option.tooltip.json"),
        (
            "visualMapContinuous",
            "documents/option-parts/option.visualMap-continuous.json",
        ),
        (
            "visualMapPiecewise",
            "documents/option-parts/option.visualMap-piecewise.json",
        ),
        ("xAxis", "documents/option-parts/option.xAxis.json"),
        ("yAxis", "documents/option-parts/option.yAxis.json"),
    ])
}

fn tutorial_hints() -> HashMap<&'static str, Vec<(&'static str, &'static str)>> {
    HashMap::from([
        (
            "aria",
            vec![("在图表中支持无障碍访问", "Supporting ARIA in Charts")],
        ),
        (
            "canvas",
            vec![("使用 Canvas 或者 SVG 渲染", "Render by Canvas or SVG")],
        ),
        ("custom", vec![("自定义系列", "Custom Series")]),
        (
            "dataZoom",
            vec![(
                "在图表中加入交互组件",
                "Add interaction to the chart component",
            )],
        ),
        (
            "dataZoomInside",
            vec![(
                "在图表中加入交互组件",
                "Add interaction to the chart component",
            )],
        ),
        (
            "dataZoomSlider",
            vec![(
                "在图表中加入交互组件",
                "Add interaction to the chart component",
            )],
        ),
        ("dataset", vec![("使用 dataset 管理数据", "Dataset")]),
        (
            "graphic",
            vec![("小例子：自己实现拖拽", "An Example: Implement Dragging")],
        ),
        (
            "svg",
            vec![("使用 Canvas 或者 SVG 渲染", "Render by Canvas or SVG")],
        ),
        (
            "transform",
            vec![("使用 transform 进行数据转换", "Data Transform")],
        ),
        ("visualMap", vec![("数据的视觉映射", "Visual Map of Data")]),
        (
            "visualMapContinuous",
            vec![("数据的视觉映射", "Visual Map of Data")],
        ),
        (
            "visualMapPiecewise",
            vec![("数据的视觉映射", "Visual Map of Data")],
        ),
    ])
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::env;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{
        build_docs_payload, create_localized_doc_bundle, load_option_root_meta, parse_doc_meta,
        resolve_option_doc_relative_path, PerLocaleOptionRootMeta,
    };

    fn temp_root() -> std::path::PathBuf {
        let root = env::temp_dir().join(format!(
            "echarts-cli-docs-meta-test-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn parses_doc_meta_with_heuristics() {
        let source = "# option.xAxis\n\n坐标轴。\n\n```js\nconst a = 1;\n```\n\n更多说明。\n";
        let meta = parse_doc_meta(source);
        assert_eq!(meta.title.as_deref(), Some("option.xAxis"));
        assert!(meta.summary.as_deref().unwrap().contains("坐标轴"));
    }

    #[test]
    fn ignores_templates_and_custom_tags_before_summary() {
        let source = r#"
# option.legend

{{ use: partial-version(
version = "6.0.0"
) }}

<ExampleUIControlBoolean name="foo" />

真正的摘要段落。
"#;
        let meta = parse_doc_meta(source);
        assert_eq!(meta.title.as_deref(), Some("option.legend"));
        assert_eq!(meta.summary.as_deref(), Some("真正的摘要段落。"));
    }

    #[test]
    fn suppresses_type_only_summaries() {
        let source = "# option.legend\n\n- Type: `boolean`\n\n更多说明。\n";
        let meta = parse_doc_meta(source);
        assert_eq!(meta.title.as_deref(), Some("option.legend"));
        assert!(meta.summary.is_none());
    }

    #[test]
    fn stops_summary_after_a_complete_first_block() {
        let source = "# title\n\n这是一个足够长而且完整的第一段摘要，会在达到启发式阈值后停止继续拼接。\n\n第二段不应进入 summary。\n";
        let meta = parse_doc_meta(source);
        assert_eq!(
            meta.summary.as_deref(),
            Some("这是一个足够长而且完整的第一段摘要，会在达到启发式阈值后停止继续拼接。")
        );
    }

    #[test]
    fn resolves_option_doc_paths() {
        assert_eq!(
            resolve_option_doc_relative_path("option", "xAxis"),
            "documents/option-parts/option.xAxis.json"
        );
        assert_eq!(
            resolve_option_doc_relative_path("chart", "line"),
            "documents/option-parts/option.series-line.json"
        );
    }

    #[test]
    fn loads_option_root_meta_and_builds_docs_payload() {
        let root = temp_root();
        fs::create_dir_all(root.join("zh/documents/option-parts")).unwrap();
        fs::create_dir_all(root.join("en/documents/option-parts")).unwrap();
        fs::create_dir_all(root.join("zh/documents/tutorial-parts")).unwrap();
        fs::create_dir_all(root.join("en/documents/tutorial-parts")).unwrap();

        fs::write(
            root.join("zh/documents/option.json"),
            r#"{"option":{"properties":{"dataset":{"description":"<b>数据集</b>","type":"Array"}}}}"#,
        )
        .unwrap();
        fs::write(
            root.join("en/documents/option.json"),
            r#"{"option":{"properties":{}}}"#,
        )
        .unwrap();
        fs::write(
            root.join("zh/documents/option-parts/option.dataset.json"),
            "{}\n",
        )
        .unwrap();
        fs::write(
            root.join("en/documents/option-parts/option.dataset.json"),
            "{}\n",
        )
        .unwrap();
        fs::write(
            root.join("zh/documents/tutorial-parts/tutorial.json"),
            r#"{"使用 dataset 管理数据":{"desc":"<p>教程</p>"}}"#,
        )
        .unwrap();
        fs::write(
            root.join("en/documents/tutorial-parts/tutorial.json"),
            r#"{"Dataset":{"desc":"<p>Tutorial</p>"}}"#,
        )
        .unwrap();

        let zh = load_option_root_meta(&root, "zh").unwrap();
        let mut meta = HashMap::new();
        meta.insert(
            "dataset".to_string(),
            PerLocaleOptionRootMeta {
                zh: zh.get("dataset").cloned(),
                en: None,
            },
        );
        let payload = build_docs_payload("option", "dataset", Some(root.as_path()), &meta).unwrap();
        assert!(payload.option.is_some());
        assert_eq!(
            payload
                .option
                .as_ref()
                .unwrap()
                .zh
                .as_ref()
                .unwrap()
                .summary
                .as_deref(),
            Some("数据集")
        );
        assert_eq!(payload.tutorials.len(), 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn creates_tutorial_refs_with_encoded_fragment() {
        let root = temp_root();
        fs::create_dir_all(root.join("zh/documents/tutorial-parts")).unwrap();
        fs::write(
            root.join("zh/documents/tutorial-parts/tutorial.json"),
            r#"{"使用 dataset 管理数据":{"desc":"<p>教程</p>"}}"#,
        )
        .unwrap();

        let tutorial = super::create_tutorial_ref(&root, "zh", "使用 dataset 管理数据")
            .unwrap()
            .unwrap();
        assert_eq!(
            tutorial.relative_path,
            "zh/documents/tutorial-parts/tutorial.json#%E4%BD%BF%E7%94%A8%20dataset%20%E7%AE%A1%E7%90%86%E6%95%B0%E6%8D%AE"
        );
        assert_eq!(tutorial.summary.as_deref(), Some("教程"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn creates_localized_bundle_with_missing_side() {
        let root = temp_root();
        fs::create_dir_all(root.join("zh/documents")).unwrap();
        fs::write(root.join("zh/documents/sample.md"), "# 标题\n\n摘要").unwrap();
        let bundle = create_localized_doc_bundle(&root, "documents/sample.md", None)
            .unwrap()
            .unwrap();
        assert!(bundle.zh.is_some());
        assert!(bundle.en.is_none());
        fs::remove_dir_all(root).unwrap();
    }
}
