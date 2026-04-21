use crate::cli::{missing_option_argument, unknown_option, CliOutput};
use crate::data::load_metadata;
use crate::models::{ListItemPayload, ListPayload};
use crate::output::{format_list_markdown, format_list_text, write_output};

const HELP: &str = "\n  Usage: list [options]\n\n  List ECharts charts, components, features, and renderers\n\n\n  Options:\n\n    --kind <kind>      Filter by kind: chart, component, feature, renderer\n    --format <format>  Output format: text, json, markdown\n    -h, --help         output usage information\n";

pub fn run(args: &[String]) -> CliOutput {
    let mut index = 0;
    let mut kind: Option<String> = None;
    let mut format = String::from("text");

    while index < args.len() {
        match args[index].as_str() {
            "-h" | "--help" => return CliOutput::stdout(HELP),
            "--kind" => {
                if index + 1 >= args.len() {
                    return missing_option_argument("--kind <kind>", None);
                }
                if args[index + 1].starts_with('-') {
                    return missing_option_argument(
                        "--kind <kind>",
                        Some(args[index + 1].as_str()),
                    );
                }
                kind = Some(args[index + 1].clone());
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
            _ => index += 1,
        }
    }

    let metadata = match load_metadata() {
        Ok(metadata) => metadata,
        Err(error) => return CliOutput::stderr(1, format!("{error}\n")),
    };

    let mut items = metadata
        .items
        .into_iter()
        .filter(|item| {
            kind.as_ref()
                .map(|value| item.kind == *value)
                .unwrap_or(true)
        })
        .map(|item| ListItemPayload {
            name: item.name,
            kind: item.kind,
            export_name: item.export_name,
            option_type: item.option_type,
        })
        .collect::<Vec<_>>();

    items.sort_by(|left, right| {
        left.kind
            .to_lowercase()
            .cmp(&right.kind.to_lowercase())
            .then(left.name.to_lowercase().cmp(&right.name.to_lowercase()))
            .then(left.name.cmp(&right.name))
    });

    let payload = ListPayload { items };
    write_output(
        &format,
        &payload,
        || format_list_text(&payload),
        || format_list_markdown(&payload),
    )
}
