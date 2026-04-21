use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    #[serde(default)]
    pub generated_at: Option<String>,
    #[serde(default)]
    pub docs_root: Option<String>,
    #[serde(default)]
    pub repo_root: Option<String>,
    #[serde(default)]
    pub items: Vec<Item>,
    #[serde(default)]
    pub examples: Vec<ExampleRef>,
    #[serde(default, rename = "optionIndex")]
    pub option_index: Vec<OptionIndexItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub name: String,
    pub kind: String,
    pub export_name: String,
    #[serde(default)]
    pub install_path: Option<String>,
    pub source_path: String,
    #[serde(default)]
    pub option_type: Option<String>,
    #[serde(default)]
    pub top_level_key: Option<String>,
    #[serde(default)]
    pub option_path: Option<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub examples: Vec<ExampleRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub docs: Option<DocsBundle>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExampleRef {
    pub id: String,
    pub file: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub relative_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tokens: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OptionIndexItem {
    pub name: String,
    pub top_level_key: String,
    pub option_path: String,
    #[serde(rename = "rawType")]
    pub raw_type: String,
    #[serde(default)]
    pub array_allowed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub docs: Option<DocsBundle>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DocsBundle {
    #[serde(default)]
    pub option: Option<LocalizedDocs>,
    #[serde(default)]
    pub tutorials: Vec<LocalizedDocs>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LocalizedDocs {
    #[serde(default)]
    pub zh: Option<DocRef>,
    #[serde(default)]
    pub en: Option<DocRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocRef {
    pub relative_path: String,
    pub title: String,
    #[serde(default)]
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListItemPayload {
    pub name: String,
    pub kind: String,
    pub export_name: String,
    #[serde(default)]
    pub option_type: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ListPayload {
    pub items: Vec<ListItemPayload>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InfoPayload {
    pub name: String,
    pub kind: String,
    pub export_name: String,
    #[serde(default)]
    pub install_path: Option<String>,
    pub source_path: String,
    #[serde(default)]
    pub option_type: Option<String>,
    #[serde(default)]
    pub top_level_key: Option<String>,
    #[serde(default)]
    pub option_path: Option<String>,
    pub dependencies: Vec<String>,
    pub examples: Vec<ExampleRef>,
    pub docs: DocsBundle,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExampleListItemPayload {
    pub id: String,
    pub file: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ExampleListPayload {
    pub query: String,
    pub examples: Vec<ExampleListItemPayload>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExampleDetailPayload {
    pub id: String,
    pub file: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tokens: Option<Vec<String>>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TypeField {
    Single(String),
    Multiple(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OptionEntry {
    pub path: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, rename = "type")]
    pub type_field: Option<TypeField>,
    #[serde(default)]
    pub default: Option<serde_json::Value>,
    #[serde(default)]
    pub is_object: bool,
    #[serde(default)]
    pub order: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedOptionDoc {
    pub lang: String,
    pub relative_path: String,
    pub title: String,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub scope_root: Option<String>,
    pub entries: std::collections::BTreeMap<String, OptionEntry>,
    #[serde(default)]
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetailedOptionPayload {
    pub name: String,
    pub kind: String,
    pub export_name: String,
    pub source_path: String,
    pub install_path: Option<String>,
    pub option_type: String,
    pub top_level_key: String,
    pub option_path: String,
    pub dependencies: Vec<String>,
    pub docs: DocsBundle,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc: Option<LoadedOptionDoc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryDocPayload {
    pub lang: String,
    pub relative_path: String,
    pub title: String,
    #[serde(default)]
    pub scope_root: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptionResultItem {
    pub path: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "type", default)]
    pub type_field: Option<TypeField>,
    #[serde(default)]
    pub default: Option<serde_json::Value>,
    pub is_object: bool,
    pub order: usize,
    pub name: String,
    pub has_children: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RelatedDocItem {
    pub name: String,
    pub option_type: String,
    pub top_level_key: String,
    #[serde(default)]
    pub doc: Option<DocRef>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OptionQueryPayload {
    pub query: String,
    #[serde(default)]
    pub context_item: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc: Option<QueryDocPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry: Option<OptionEntry>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<OptionResultItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_tokens: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub results: Option<Vec<OptionResultItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub related_docs: Option<Vec<RelatedDocItem>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_desc: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub view_mode: Option<String>,
}
