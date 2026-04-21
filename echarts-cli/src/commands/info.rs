use crate::cli::{missing_option_argument, missing_required_argument, unknown_option, CliOutput};
use crate::data::{docs_or_default, resolve_item};
use crate::models::InfoPayload;
use crate::output::{format_info_markdown, format_info_text, write_output};

const HELP: &str = "\n  Usage: info [options] <name>\n\n  Show metadata for a chart, component, feature, or renderer\n\n\n  Options:\n\n    --format <format>  Output format: text, json, markdown\n    -h, --help         output usage information\n";

pub fn run(args: &[String]) -> CliOutput {
    let mut index = 0;
    let mut name: Option<String> = None;
    let mut format = String::from("text");

    while index < args.len() {
        match args[index].as_str() {
            "-h" | "--help" => return CliOutput::stdout(HELP),
            "--format" => {
                if index + 1 >= args.len() {
                    return missing_option_argument("--format <format>", None);
                }
                if args[index + 1].starts_with('-') {
                    if args[index + 1] == "--help" || args[index + 1] == "-h" {
                        index += 2;
                        continue;
                    }
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
                if name.is_none() {
                    name = Some(value.to_string());
                }
                index += 1;
            }
        }
    }

    let name = match name {
        Some(name) => name,
        None => return missing_required_argument("name"),
    };

    let item = match resolve_item(&name) {
        Ok(Some(item)) => item,
        Ok(None) => {
            return CliOutput::stderr(1, format!("Unknown ECharts item: {name}\n"));
        }
        Err(error) => return CliOutput::stderr(1, format!("{error}\n")),
    };

    let payload = InfoPayload {
        name: item.name,
        kind: item.kind,
        export_name: item.export_name,
        install_path: item.install_path,
        source_path: item.source_path,
        option_type: item.option_type,
        top_level_key: item.top_level_key,
        option_path: item.option_path,
        dependencies: item.dependencies,
        examples: item.examples,
        docs: docs_or_default(item.docs),
    };

    write_output(
        &format,
        &payload,
        || format_info_text(&payload),
        || format_info_markdown(&payload),
    )
}
