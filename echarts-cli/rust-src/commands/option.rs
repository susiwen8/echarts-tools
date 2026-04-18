use crate::cli::{missing_option_argument, unknown_option, CliOutput};
use crate::data::{
    build_option_results, docs_or_default, load_metadata, load_option_doc,
    load_option_doc_from_query_doc, resolve_fine_option_query, resolve_item,
    resolve_top_level_option,
};
use crate::models::{DetailedOptionPayload, ListItemPayload, ListPayload};
use crate::output::{
    format_detailed_option_markdown, format_detailed_option_text, format_list_markdown,
    format_list_text, format_option_query_markdown, format_option_query_text, write_output,
};

const HELP: &str = "\n  Usage: option [options] [query...]\n\n  Inspect top-level option keys or option metadata for a specific item\n\n\n  Options:\n\n    --full-desc        Show fuller property descriptions in query output\n    --grep             Flatten recursive query results for quick filtering\n    --lang <lang>      Doc language: zh, en\n    --tree             Show recursive query results as a tree\n    --format <format>  Output format: text, json, markdown\n    -h, --help         output usage information\n";

pub fn run(args: &[String]) -> CliOutput {
    let mut index = 0;
    let mut query = Vec::new();
    let mut full_desc = false;
    let mut grep = false;
    let mut tree = false;
    let mut lang = String::from("zh");
    let mut format = String::from("text");

    while index < args.len() {
        match args[index].as_str() {
            "-h" | "--help" => return CliOutput::stdout(HELP),
            "--full-desc" => {
                full_desc = true;
                index += 1;
            }
            "--grep" => {
                grep = true;
                index += 1;
            }
            "--tree" => {
                tree = true;
                index += 1;
            }
            "--lang" => {
                if index + 1 >= args.len() {
                    return missing_option_argument("--lang <lang>", None);
                }
                if args[index + 1].starts_with('-') {
                    return missing_option_argument(
                        "--lang <lang>",
                        Some(args[index + 1].as_str()),
                    );
                }
                if args[index + 1] == "en" {
                    lang = "en".to_string();
                } else {
                    lang = "zh".to_string();
                }
                index += 2;
            }
            "--format" => {
                if index + 1 >= args.len() {
                    return missing_option_argument("--format <format>", None);
                }
                if args[index + 1].starts_with('-') {
                    return missing_option_argument(
                        "--format <format>",
                        Some(args[index + 1].as_str()),
                    );
                }
                format = args[index + 1].clone();
                index += 2;
            }
            flag if flag.starts_with('-') => return unknown_option(flag),
            value => {
                query.push(value.to_string());
                index += 1;
            }
        }
    }

    let view_mode = if tree {
        Some("tree".to_string())
    } else if grep {
        Some("grep".to_string())
    } else {
        None
    };

    if query.is_empty() {
        let metadata = match load_metadata() {
            Ok(metadata) => metadata,
            Err(error) => return CliOutput::stderr(1, format!("{error}\n")),
        };
        let payload = ListPayload {
            items: metadata
                .option_index
                .into_iter()
                .map(|option| ListItemPayload {
                    name: option.name.clone(),
                    kind: "option".to_string(),
                    export_name: option.name,
                    option_type: Some(option.raw_type),
                })
                .collect(),
        };
        return write_output(
            &format,
            &payload,
            || format_list_text(&payload),
            || format_list_markdown(&payload),
        );
    }

    if query.len() > 1 || query[0].contains('.') {
        let mut payload = match resolve_fine_option_query(&query, &lang) {
            Ok(Some(payload)) => payload,
            Ok(None) => {
                let target = query.first().cloned().unwrap_or_default();
                return CliOutput::stderr(1, format!("Unknown option target: {target}\n"));
            }
            Err(error) => return CliOutput::stderr(1, format!("{error}\n")),
        };
        payload.full_desc = Some(full_desc);
        if let Some(view_mode) = view_mode {
            if payload.results.is_none() {
                if let Some(doc_info) = &payload.doc {
                    if let Ok(doc_state) = load_option_doc_from_query_doc(doc_info) {
                        payload.results =
                            Some(build_option_results(&doc_state, payload.path.as_deref()));
                    }
                }
            }
            payload.view_mode = Some(view_mode);
        }
        return write_output(
            &format,
            &payload,
            || format_option_query_text(&payload),
            || format_option_query_markdown(&payload),
        );
    }

    let resolved_name = query[0].clone();

    let resolved_item = match resolve_item(&resolved_name) {
        Ok(item) => item,
        Err(error) => return CliOutput::stderr(1, format!("{error}\n")),
    };

    if let Some(item) = resolved_item {
        let docs = docs_or_default(item.docs.clone());
        let payload = DetailedOptionPayload {
            name: item.name,
            kind: item.kind,
            export_name: item.export_name,
            source_path: item.source_path,
            install_path: item.install_path,
            option_type: item.option_type.unwrap_or_default(),
            top_level_key: item.top_level_key.unwrap_or_default(),
            option_path: item.option_path.unwrap_or_default(),
            dependencies: item.dependencies,
            docs: docs.clone(),
            doc: match load_option_doc(docs.option.as_ref(), &lang) {
                Ok(doc) => doc,
                Err(error) => return CliOutput::stderr(1, format!("{error}\n")),
            },
        };
        return write_output(
            &format,
            &payload,
            || format_detailed_option_text(&payload),
            || format_detailed_option_markdown(&payload),
        );
    }

    let option = match resolve_top_level_option(&resolved_name) {
        Ok(Some(option)) => option,
        Ok(None) => {
            return CliOutput::stderr(1, format!("Unknown option target: {resolved_name}\n"))
        }
        Err(error) => return CliOutput::stderr(1, format!("{error}\n")),
    };

    let docs = docs_or_default(option.docs.clone());
    let payload = DetailedOptionPayload {
        name: option.name.clone(),
        kind: "option".to_string(),
        export_name: option.name,
        source_path: "src/export/option.ts".to_string(),
        install_path: None,
        option_type: option.raw_type,
        top_level_key: option.top_level_key,
        option_path: option.option_path,
        dependencies: Vec::new(),
        docs: docs.clone(),
        doc: match load_option_doc(docs.option.as_ref(), &lang) {
            Ok(doc) => doc,
            Err(error) => return CliOutput::stderr(1, format!("{error}\n")),
        },
    };

    write_output(
        &format,
        &payload,
        || format_detailed_option_text(&payload),
        || format_detailed_option_markdown(&payload),
    )
}

#[cfg(test)]
mod tests {
    use super::run;

    #[test]
    fn tree_json_output_keeps_expected_nodes() {
        let output = run(&[
            "xAxis.axisLabel".to_string(),
            "--tree".to_string(),
            "--format".to_string(),
            "json".to_string(),
        ]);

        assert_eq!(output.status, 0, "{}", output.stderr);
        let payload: serde_json::Value =
            serde_json::from_str(&output.stdout).expect("option tree json");
        let results = payload["results"].as_array().expect("results array");

        assert_eq!(payload["path"], "axisLabel");
        assert!(results.iter().any(|item| item["path"] == "axisLabel"));
        assert!(results
            .iter()
            .any(|item| item["path"] == "axisLabel.rotate"));
        assert!(results
            .iter()
            .any(|item| item["path"] == "axisLabel.formatter"));
    }

    #[test]
    fn grep_text_output_keeps_flattened_paths() {
        let output = run(&["xAxis.axisLabel".to_string(), "--grep".to_string()]);

        assert_eq!(output.status, 0, "{}", output.stderr);
        assert!(output.stdout.contains("axisLabel.rotate"));
        assert!(output.stdout.contains("axisLabel.formatter"));
    }
}
