use std::collections::BTreeMap;

use serde::Deserialize;

use crate::models::OptionEntry;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReducedOptionDoc {
    pub title: Option<String>,
    pub scope_root: Option<String>,
    #[serde(default)]
    pub entries: BTreeMap<String, OptionEntry>,
    #[serde(default)]
    pub content: Option<String>,
}

pub fn render_option_json_doc(
    relative_path: &str,
    source: &str,
) -> Result<ReducedOptionDoc, String> {
    let mut parsed: ReducedOptionDoc = serde_json::from_str(source)
        .map_err(|error| format!("Failed to parse reduced option doc {relative_path}: {error}"))?;

    if parsed.title.is_none() {
        parsed.title = Some(
            relative_path
                .rsplit('/')
                .next()
                .unwrap_or(relative_path)
                .trim_end_matches(".json")
                .to_string(),
        );
    }

    if parsed.content.is_none() {
        let title = parsed
            .title
            .clone()
            .unwrap_or_else(|| relative_path.to_string());
        parsed.content = Some(build_option_doc_content(&title, &parsed.entries));
    }

    Ok(parsed)
}

fn build_option_doc_content(title: &str, entries: &BTreeMap<String, OptionEntry>) -> String {
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
