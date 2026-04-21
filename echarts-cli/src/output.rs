use serde::Serialize;

use crate::cli::CliOutput;
use crate::models::{
    DetailedOptionPayload, DocsBundle, ExampleDetailPayload, ExampleListPayload, InfoPayload,
    ListPayload, OptionQueryPayload, OptionResultItem, TypeField,
};

pub fn write_output<T, FText, FMarkdown>(
    format: &str,
    payload: &T,
    text: FText,
    markdown: FMarkdown,
) -> CliOutput
where
    T: Serialize,
    FText: FnOnce() -> String,
    FMarkdown: FnOnce() -> String,
{
    match format {
        "json" => CliOutput {
            status: 0,
            stdout: format!(
                "{}\n",
                serde_json::to_string_pretty(payload).expect("json serialization")
            ),
            stderr: String::new(),
        },
        "markdown" => CliOutput {
            status: 0,
            stdout: format!("{}\n", markdown()),
            stderr: String::new(),
        },
        _ => CliOutput {
            status: 0,
            stdout: format!("{}\n", text()),
            stderr: String::new(),
        },
    }
}

pub fn format_list_text(payload: &ListPayload) -> String {
    payload
        .items
        .iter()
        .map(|item| {
            let option_part = item
                .option_type
                .as_ref()
                .map(|value| format!(" {value}"))
                .unwrap_or_default();
            format!("{: <10} {: <20}{}", item.kind, item.name, option_part)
                .trim_end()
                .to_string()
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn format_list_markdown(payload: &ListPayload) -> String {
    let mut lines = vec![
        "| Kind | Name | Option Type |".to_string(),
        "| --- | --- | --- |".to_string(),
    ];
    for item in &payload.items {
        lines.push(format!(
            "| {} | {} | {} |",
            item.kind,
            item.name,
            item.option_type.as_deref().unwrap_or("-")
        ));
    }
    lines.join("\n")
}

pub fn format_info_text(payload: &InfoPayload) -> String {
    let mut lines = vec![
        format!("{} ({})", payload.name, payload.kind),
        format!("Export: {}", payload.export_name),
        format!("Source: {}", payload.source_path),
    ];

    if let Some(option_type) = &payload.option_type {
        lines.push(format!("Option Type: {option_type}"));
    }
    if let Some(option_path) = &payload.option_path {
        lines.push(format!("Option Path: {option_path}"));
    }

    push_text_docs(&mut lines, &payload.docs);

    if !payload.examples.is_empty() {
        lines.push(String::new());
        lines.push("Examples:".to_string());
        for example in &payload.examples {
            lines.push(format!("- {}", example.file));
        }
    }

    lines.join("\n")
}

pub fn format_info_markdown(payload: &InfoPayload) -> String {
    let mut lines = vec![
        format!("# {}", payload.name),
        String::new(),
        format!("- Kind: `{}`", payload.kind),
        format!("- Export: `{}`", payload.export_name),
        format!("- Source: `{}`", payload.source_path),
    ];

    if let Some(option_type) = &payload.option_type {
        lines.push(format!("- Option Type: `{option_type}`"));
    }
    if let Some(option_path) = &payload.option_path {
        lines.push(format!("- Option Path: `{option_path}`"));
    }

    push_markdown_docs(&mut lines, &payload.docs);

    if !payload.examples.is_empty() {
        lines.push(String::new());
        lines.push("## Examples".to_string());
        lines.push(String::new());
        for example in &payload.examples {
            lines.push(format!("- `{}`", example.file));
        }
    }

    lines.join("\n")
}

pub fn format_detailed_option_text(payload: &DetailedOptionPayload) -> String {
    let mut lines = vec![
        format!("{} ({})", payload.name, payload.kind),
        format!("Export: {}", payload.export_name),
        format!("Source: {}", payload.source_path),
    ];

    lines.push(format!("Option Type: {}", payload.option_type));
    lines.push(format!("Option Path: {}", payload.option_path));

    if let Some(doc) = &payload.doc {
        if let Some(summary) = &doc.summary {
            lines.push(format!("Summary: {summary}"));
        }
        lines.push(String::new());
        lines.push(format!("Documentation ({}):", doc.relative_path));
        if let Some(content) = &doc.content {
            lines.push(content.clone());
        }
    }

    lines.join("\n")
}

pub fn format_detailed_option_markdown(payload: &DetailedOptionPayload) -> String {
    let mut lines = vec![
        format!("# {}", payload.name),
        String::new(),
        format!("- Kind: `{}`", payload.kind),
        format!("- Export: `{}`", payload.export_name),
        format!("- Source: `{}`", payload.source_path),
        format!("- Option Type: `{}`", payload.option_type),
        format!("- Option Path: `{}`", payload.option_path),
    ];

    if let Some(doc) = &payload.doc {
        if let Some(summary) = &doc.summary {
            lines.push(String::new());
            lines.push(format!("> {summary}"));
        }

        lines.push(String::new());
        lines.push(format!("## Documentation (`{}`)", doc.relative_path));
        lines.push(String::new());
        if let Some(content) = &doc.content {
            lines.push("```md".to_string());
            lines.push(content.clone());
            lines.push("```".to_string());
        }
    }

    lines.join("\n")
}

pub fn format_option_query_text(payload: &OptionQueryPayload) -> String {
    if let Some(related_docs) = &payload.related_docs {
        if !related_docs.is_empty() {
            let mut lines = vec![format!("Query: {}", payload.query)];
            if let Some(context_item) = &payload.context_item {
                lines.push(format!("Context: {context_item}"));
            }
            lines.push(String::new());
            lines.push("Related option docs:".to_string());
            for doc in related_docs {
                lines.push(format!(
                    "- {}{}",
                    doc.name,
                    if doc.option_type.is_empty() {
                        String::new()
                    } else {
                        format!(" ({})", doc.option_type)
                    }
                ));
                if let Some(summary) = &doc.summary {
                    lines.push(format!("  {}", truncate_line(summary, 180)));
                }
                if let Some(doc_ref) = &doc.doc {
                    lines.push(format!("  Doc: {}", doc_ref.relative_path));
                }
            }
            return lines.join("\n");
        }
    }

    if let Some(results) = &payload.results {
        if payload.view_mode.as_deref() == Some("grep") {
            return results
                .iter()
                .map(|result| {
                    let mut pieces = vec![result.path.clone()];
                    if let Some(type_field) = &result.type_field {
                        pieces.push(format!("type={}", format_type(type_field)));
                    }
                    if let Some(default) = &result.default {
                        pieces.push(format!("default={}", format_default(default)));
                    }
                    pieces.join("\t")
                })
                .collect::<Vec<_>>()
                .join("\n");
        }

        if payload.view_mode.as_deref() == Some("tree") {
            return build_text_tree(results, true);
        }

        if !results.is_empty() {
            let mut lines = vec![format!("Query: {}", payload.query)];
            if let Some(context_item) = &payload.context_item {
                lines.push(format!("Context: {context_item}"));
            }
            if let Some(doc) = &payload.doc {
                lines.push(format!("Doc: {} ({})", doc.title, doc.relative_path));
            }
            lines.push(String::new());
            lines.push("Matches:".to_string());
            for result in results {
                lines.push(format_search_result_line(result));
                if let Some(description) = &result.description {
                    lines.push(format!(
                        "  {}",
                        render_property_description(
                            description,
                            payload.full_desc.unwrap_or(false)
                        )
                    ));
                }
            }
            return lines.join("\n");
        }
    }

    let mut lines = vec![format!("Query: {}", payload.query)];
    if let Some(context_item) = &payload.context_item {
        lines.push(format!("Context: {context_item}"));
    }
    if let Some(doc) = &payload.doc {
        lines.push(format!("Doc: {} ({})", doc.title, doc.relative_path));
    }
    if let Some(path) = &payload.path {
        lines.push(format!("Path: {path}"));
    }
    if let Some(entry) = &payload.entry {
        if let Some(type_field) = &entry.type_field {
            lines.push(format!(
                "Type: {}",
                format_type(type_field).replace('|', " | ")
            ));
        }
        if let Some(default) = &entry.default {
            lines.push(format!("Default: {}", format_default(default)));
        }
        if let Some(description) = &entry.description {
            lines.push(String::new());
            lines.push(description.clone());
        }
    }
    if let Some(children) = &payload.children {
        if !children.is_empty() {
            lines.push(String::new());
            lines.push("Available properties:".to_string());
            for child in children {
                lines.push(format_result_line(child));
                if let Some(description) = &child.description {
                    lines.push(format!(
                        "  {}",
                        render_property_description(
                            description,
                            payload.full_desc.unwrap_or(false)
                        )
                    ));
                }
            }
        }
    }
    lines.join("\n")
}

pub fn format_option_query_markdown(payload: &OptionQueryPayload) -> String {
    if let Some(related_docs) = &payload.related_docs {
        if !related_docs.is_empty() {
            let mut lines = vec![format!("# {}", payload.query), String::new()];
            if let Some(context_item) = &payload.context_item {
                lines.push(format!("- Context: `{}`", context_item));
            }
            lines.push(String::new());
            lines.push("## Related option docs".to_string());
            lines.push(String::new());
            for doc in related_docs {
                let mut header = vec![format!("- `{}`", doc.name)];
                if !doc.option_type.is_empty() {
                    header.push(format!("type=`{}`", doc.option_type));
                }
                lines.push(header.join(" "));
                if let Some(summary) = &doc.summary {
                    lines.push(format!("  - {}", truncate_line(summary, 180)));
                }
                if let Some(doc_ref) = &doc.doc {
                    lines.push(format!("  - doc: `{}`", doc_ref.relative_path));
                }
            }
            return lines.join("\n");
        }
    }

    if let Some(results) = &payload.results {
        if payload.view_mode.as_deref() == Some("grep") {
            return results
                .iter()
                .map(|result| {
                    let mut pieces = vec![format!("`{}`", result.path)];
                    if let Some(type_field) = &result.type_field {
                        pieces.push(format!("type=`{}`", format_type(type_field)));
                    }
                    if let Some(default) = &result.default {
                        pieces.push(format!("default=`{}`", format_default(default)));
                    }
                    format!("- {}", pieces.join(" "))
                })
                .collect::<Vec<_>>()
                .join("\n");
        }

        if payload.view_mode.as_deref() == Some("tree") {
            return [
                "```text".to_string(),
                build_text_tree(results, false),
                "```".to_string(),
            ]
            .join("\n");
        }

        if !results.is_empty() {
            let mut lines = vec![format!("# {}", payload.query), String::new()];
            if let Some(context_item) = &payload.context_item {
                lines.push(format!("- Context: `{}`", context_item));
            }
            if let Some(doc) = &payload.doc {
                lines.push(format!("- Doc: `{}` (`{}`)", doc.title, doc.relative_path));
            }
            lines.push(String::new());
            lines.push("## Matches".to_string());
            lines.push(String::new());
            for result in results {
                lines.push(format_markdown_search_result_line(result));
                if let Some(description) = &result.description {
                    lines.push(format!(
                        "  - {}",
                        render_property_description(
                            description,
                            payload.full_desc.unwrap_or(false)
                        )
                    ));
                }
            }
            return lines.join("\n");
        }
    }

    let mut lines = vec![format!("# {}", payload.query), String::new()];
    if let Some(context_item) = &payload.context_item {
        lines.push(format!("- Context: `{}`", context_item));
    }
    if let Some(doc) = &payload.doc {
        lines.push(format!("- Doc: `{}` (`{}`)", doc.title, doc.relative_path));
    }
    if let Some(path) = &payload.path {
        lines.push(format!("- Path: `{}`", path));
    }
    if let Some(entry) = &payload.entry {
        if let Some(type_field) = &entry.type_field {
            lines.push(format!(
                "- Type: `{}`",
                format_type(type_field).replace('|', " | ")
            ));
        }
        if let Some(default) = &entry.default {
            lines.push(format!("- Default: `{}`", format_default(default)));
        }
        if let Some(description) = &entry.description {
            lines.push(String::new());
            lines.push(description.clone());
        }
    }
    if let Some(children) = &payload.children {
        if !children.is_empty() {
            lines.push(String::new());
            lines.push("## Available properties".to_string());
            lines.push(String::new());
            for child in children {
                lines.push(format_markdown_result_line(child));
                if let Some(description) = &child.description {
                    lines.push(format!(
                        "  - {}",
                        render_property_description(
                            description,
                            payload.full_desc.unwrap_or(false)
                        )
                    ));
                }
            }
        }
    }
    lines.join("\n")
}

pub fn format_example_list_text(payload: &ExampleListPayload) -> String {
    payload
        .examples
        .iter()
        .map(|example| format!("{} — {}", example.title, example.id))
        .collect::<Vec<_>>()
        .join("\n")
}

pub fn format_example_list_markdown(payload: &ExampleListPayload) -> String {
    let mut lines = vec!["| Title | ID |".to_string(), "| --- | --- |".to_string()];
    for example in &payload.examples {
        lines.push(format!("| {} | {} |", example.title, example.id));
    }
    lines.join("\n")
}

pub fn format_example_text(payload: &ExampleDetailPayload) -> String {
    format!(
        "{}\nID: {}\n\n{}",
        payload.title, payload.id, payload.content
    )
}

pub fn format_example_markdown(payload: &ExampleDetailPayload) -> String {
    format!(
        "# {}\n\n- ID: `{}`\n\n```html\n{}\n```",
        payload.title, payload.id, payload.content
    )
}

fn push_text_docs(lines: &mut Vec<String>, docs: &DocsBundle) {
    let primary_summary = docs
        .option
        .as_ref()
        .and_then(|bundle| bundle.zh.as_ref().or(bundle.en.as_ref()))
        .and_then(|doc| doc.summary.as_ref());

    if let Some(summary) = primary_summary {
        lines.push(format!("Summary: {summary}"));
    }

    if let Some(option_docs) = &docs.option {
        if option_docs.zh.is_some() || option_docs.en.is_some() {
            lines.push(String::new());
            lines.push("Docs:".to_string());
            if let Some(doc) = &option_docs.zh {
                lines.push(format!("- zh option: {}", doc.relative_path));
            }
            if let Some(doc) = &option_docs.en {
                lines.push(format!("- en option: {}", doc.relative_path));
            }
        }
    }

    if !docs.tutorials.is_empty() {
        lines.push(String::new());
        lines.push("Tutorials:".to_string());
        for tutorial in &docs.tutorials {
            if let Some(doc) = &tutorial.zh {
                lines.push(format!("- zh: {} ({})", doc.title, doc.relative_path));
            }
            if let Some(doc) = &tutorial.en {
                lines.push(format!("- en: {} ({})", doc.title, doc.relative_path));
            }
        }
    }
}

fn push_markdown_docs(lines: &mut Vec<String>, docs: &DocsBundle) {
    let primary_summary = docs
        .option
        .as_ref()
        .and_then(|bundle| bundle.zh.as_ref().or(bundle.en.as_ref()))
        .and_then(|doc| doc.summary.as_ref());

    if let Some(summary) = primary_summary {
        lines.push(String::new());
        lines.push(format!("> {summary}"));
    }

    if let Some(option_docs) = &docs.option {
        if option_docs.zh.is_some() || option_docs.en.is_some() {
            lines.push(String::new());
            lines.push("## Docs".to_string());
            lines.push(String::new());
            if let Some(doc) = &option_docs.zh {
                lines.push(format!("- zh option: `{}`", doc.relative_path));
            }
            if let Some(doc) = &option_docs.en {
                lines.push(format!("- en option: `{}`", doc.relative_path));
            }
        }
    }

    if !docs.tutorials.is_empty() {
        lines.push(String::new());
        lines.push("## Tutorials".to_string());
        lines.push(String::new());
        for tutorial in &docs.tutorials {
            if let Some(doc) = &tutorial.zh {
                lines.push(format!("- zh: `{}`", doc.relative_path));
            }
            if let Some(doc) = &tutorial.en {
                lines.push(format!("- en: `{}`", doc.relative_path));
            }
        }
    }
}

fn format_result_line(result: &OptionResultItem) -> String {
    let mut pieces = vec![format!("- {}", result.name)];
    if let Some(type_field) = &result.type_field {
        pieces.push(format!("type={}", format_type(type_field)));
    }
    if let Some(default) = &result.default {
        pieces.push(format!("default={}", format_default(default)));
    }
    if result.has_children {
        pieces.push("children".to_string());
    }
    pieces.join(" ")
}

fn format_search_result_line(result: &OptionResultItem) -> String {
    let mut pieces = vec![format!("- {}", result.path)];
    if let Some(type_field) = &result.type_field {
        pieces.push(format!("type={}", format_type(type_field)));
    }
    if let Some(default) = &result.default {
        pieces.push(format!("default={}", format_default(default)));
    }
    if result.has_children {
        pieces.push("children".to_string());
    }
    pieces.join(" ")
}

fn format_markdown_result_line(result: &OptionResultItem) -> String {
    let mut pieces = vec![format!("- `{}`", result.name)];
    if let Some(type_field) = &result.type_field {
        pieces.push(format!("type=`{}`", format_type(type_field)));
    }
    if let Some(default) = &result.default {
        pieces.push(format!("default=`{}`", format_default(default)));
    }
    if result.has_children {
        pieces.push("has-children".to_string());
    }
    pieces.join(" ")
}

fn format_markdown_search_result_line(result: &OptionResultItem) -> String {
    let mut pieces = vec![format!("- `{}`", result.path)];
    if let Some(type_field) = &result.type_field {
        pieces.push(format!("type=`{}`", format_type(type_field)));
    }
    if let Some(default) = &result.default {
        pieces.push(format!("default=`{}`", format_default(default)));
    }
    if result.has_children {
        pieces.push("has-children".to_string());
    }
    pieces.join(" ")
}

fn format_type(type_field: &TypeField) -> String {
    match type_field {
        TypeField::Single(value) => value.clone(),
        TypeField::Multiple(values) => values.join("|"),
    }
}

fn format_default(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(text) => text.clone(),
        _ => value.to_string(),
    }
}

fn build_text_tree(results: &[OptionResultItem], include_descriptions: bool) -> String {
    use std::collections::BTreeMap;

    #[derive(Clone)]
    struct Node {
        name: String,
        path: String,
        entry: Option<OptionResultItem>,
        children: Vec<String>,
    }

    let mut node_map: BTreeMap<String, Node> = BTreeMap::new();

    fn ensure_node(node_map: &mut BTreeMap<String, Node>, path: &str) {
        node_map.entry(path.to_string()).or_insert_with(|| Node {
            name: path.split('.').last().unwrap_or(path).to_string(),
            path: path.to_string(),
            entry: None,
            children: Vec::new(),
        });
    }

    for result in results {
        let parts = result.path.split('.').collect::<Vec<_>>();
        for index in 0..parts.len() {
            let path = parts[..=index].join(".");
            ensure_node(&mut node_map, &path);
            if index > 0 {
                let parent_path = parts[..index].join(".");
                ensure_node(&mut node_map, &parent_path);
                let parent = node_map.get_mut(&parent_path).expect("parent node");
                if !parent.children.contains(&path) {
                    parent.children.push(path.clone());
                }
            }
            if path == result.path {
                node_map.get_mut(&path).expect("node").entry = Some(result.clone());
            }
        }
    }

    let mut roots = node_map
        .values()
        .filter(|node| !node.path.contains('.'))
        .cloned()
        .collect::<Vec<_>>();
    roots.sort_by(|left, right| node_sort_key(left).cmp(&node_sort_key(right)));

    fn node_sort_key(node: &Node) -> (usize, String) {
        let order = node
            .entry
            .as_ref()
            .map(|entry| entry.order)
            .unwrap_or(usize::MAX);
        (order, node.path.clone())
    }

    fn visit(
        node: &Node,
        depth: usize,
        node_map: &BTreeMap<String, Node>,
        lines: &mut Vec<String>,
        include_descriptions: bool,
    ) {
        let mut pieces = vec![format!("{}{}", "  ".repeat(depth), node.name)];
        if let Some(entry) = &node.entry {
            if let Some(type_field) = &entry.type_field {
                pieces.push(format!("type={}", format_type(type_field)));
            }
            if let Some(default) = &entry.default {
                pieces.push(format!("default={}", format_default(default)));
            }
        }
        lines.push(pieces.join(" "));

        if include_descriptions {
            if let Some(entry) = &node.entry {
                if let Some(description) = &entry.description {
                    lines.push(format!(
                        "{}{}",
                        "  ".repeat(depth + 1),
                        render_property_description(description, false)
                    ));
                }
            }
        }

        let mut children = node
            .children
            .iter()
            .filter_map(|path| node_map.get(path))
            .cloned()
            .collect::<Vec<_>>();
        children.sort_by(|left, right| node_sort_key(left).cmp(&node_sort_key(right)));
        for child in children {
            visit(&child, depth + 1, node_map, lines, include_descriptions);
        }
    }

    let mut lines = Vec::new();
    for root in roots {
        visit(&root, 0, &node_map, &mut lines, include_descriptions);
    }
    lines.join("\n")
}

fn truncate_line(value: &str, max_length: usize) -> String {
    let text = value.trim();
    if text.chars().count() <= max_length {
        return text.to_string();
    }
    let truncated = text
        .chars()
        .take(max_length.saturating_sub(1))
        .collect::<String>();
    format!("{truncated}…")
}

fn strip_code_blocks(value: &str) -> String {
    let mut result = String::new();
    let mut chars = value.chars().peekable();
    let mut in_fence = false;
    let mut in_inline = false;

    while let Some(ch) = chars.next() {
        if ch == '`' {
            let mut tick_count = 1;
            while matches!(chars.peek(), Some('`')) {
                chars.next();
                tick_count += 1;
            }
            if tick_count >= 3 {
                in_fence = !in_fence;
                result.push(' ');
            } else {
                in_inline = !in_inline;
                result.push(' ');
            }
            continue;
        }
        if !in_fence && !in_inline {
            result.push(ch);
        }
    }

    result
}

fn summarize_description(value: &str) -> String {
    let mut stripped = collapse_whitespace(&strip_code_blocks(value));
    for marker in [
        "如下示例",
        "示例：",
        "示例:",
        "例如：",
        "例如:",
        "详情参见教程",
        "详情参见",
    ] {
        if let Some(index) = stripped.find(marker) {
            if index > 0 {
                stripped = stripped[..index].trim().to_string();
            }
            break;
        }
    }

    if let Some(sentence) = first_sentence(&stripped) {
        stripped = sentence;
    }

    truncate_line(&stripped, 140)
}

#[cfg(test)]
mod tests {
    use super::write_output;
    use serde::Serialize;
    use std::cell::Cell;
    use std::rc::Rc;

    #[derive(Serialize)]
    struct Payload {
        value: &'static str,
    }

    #[test]
    fn json_output_skips_text_and_markdown_rendering() {
        let payload = Payload { value: "ok" };
        let output = write_output(
            "json",
            &payload,
            || panic!("text renderer should not run"),
            || panic!("markdown renderer should not run"),
        );

        assert_eq!(output.status, 0);
        assert!(output.stdout.contains("\"value\": \"ok\""));
    }

    #[test]
    fn text_output_only_runs_text_renderer() {
        let payload = Payload { value: "ok" };
        let markdown_called = Rc::new(Cell::new(false));
        let markdown_called_ref = Rc::clone(&markdown_called);
        let output = write_output(
            "text",
            &payload,
            || "text".to_string(),
            move || {
                markdown_called_ref.set(true);
                "markdown".to_string()
            },
        );

        assert_eq!(output.stdout, "text\n");
        assert!(!markdown_called.get());
    }
}

fn full_description(value: &str) -> String {
    collapse_whitespace(&strip_code_blocks(value))
}

fn render_property_description(value: &str, full_desc: bool) -> String {
    if full_desc {
        full_description(value)
    } else {
        summarize_description(value)
    }
}

fn collapse_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn first_sentence(value: &str) -> Option<String> {
    let chars = value.chars().collect::<Vec<_>>();
    let mut collected = String::new();
    for (index, character) in chars.iter().enumerate() {
        collected.push(*character);
        if matches!(character, '。' | '！' | '？' | '.' | '!' | '?') {
            let next = chars.get(index + 1);
            if next.is_none() || next.is_some_and(|next| next.is_whitespace()) {
                return Some(collected.trim().to_string());
            }
        }
    }
    None
}
