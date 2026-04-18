use crate::cli::{missing_option_argument, missing_required_argument, unknown_option, CliOutput};
use crate::data::{find_examples, load_example_content};
use crate::models::{ExampleDetailPayload, ExampleListItemPayload, ExampleListPayload};
use crate::output::{
    format_example_list_markdown, format_example_list_text, format_example_markdown,
    format_example_text, write_output,
};

const HELP: &str = "\n  Usage: example [options] <query> [id]\n\n  List matching examples or print a specific example source\n\n\n  Options:\n\n    --format <format>  Output format: text, json, markdown\n    -h, --help         output usage information\n";

pub fn run(args: &[String]) -> CliOutput {
    let mut index = 0;
    let mut query: Option<String> = None;
    let mut example_id: Option<String> = None;
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
                if query.is_none() {
                    query = Some(value.to_string());
                } else if example_id.is_none() {
                    example_id = Some(value.to_string());
                }
                index += 1;
            }
        }
    }

    let query = match query {
        Some(query) => query,
        None => return missing_required_argument("query"),
    };

    let examples = match find_examples(&query) {
        Ok(examples) if !examples.is_empty() => examples,
        Ok(_) => return CliOutput::stderr(1, format!("No examples found for query: {query}\n")),
        Err(error) => return CliOutput::stderr(1, format!("{error}\n")),
    };

    if let Some(example_id) = example_id {
        let example = match examples
            .into_iter()
            .find(|item| item.id == example_id || item.file == example_id)
        {
            Some(example) => example,
            None => return CliOutput::stderr(1, format!("No example matched id: {example_id}\n")),
        };

        let content = match load_example_content(&example) {
            Ok(Some(content)) => content,
            Ok(None) => {
                return CliOutput::stderr(
                    1,
                    format!("Example content unavailable for id: {example_id}\n"),
                )
            }
            Err(error) => return CliOutput::stderr(1, format!("{error}\n")),
        };

        let payload = ExampleDetailPayload {
            id: example.id,
            file: example.file,
            title: example.title,
            tokens: example.tokens,
            content,
        };

        return write_output(
            &format,
            &payload,
            || format_example_text(&payload),
            || format_example_markdown(&payload),
        );
    }

    let payload = ExampleListPayload {
        query,
        examples: examples
            .into_iter()
            .map(|example| ExampleListItemPayload {
                id: example.id,
                file: example.file,
                title: example.title,
            })
            .collect(),
    };

    write_output(
        &format,
        &payload,
        || format_example_list_text(&payload),
        || format_example_list_markdown(&payload),
    )
}
