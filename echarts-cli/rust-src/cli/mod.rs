use crate::commands;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CliOutput {
    pub status: i32,
    pub stdout: String,
    pub stderr: String,
}

impl CliOutput {
    pub fn success() -> Self {
        Self {
            status: 0,
            stdout: String::new(),
            stderr: String::new(),
        }
    }

    pub fn stdout(text: &'static str) -> Self {
        Self {
            status: 0,
            stdout: text.to_string(),
            stderr: String::new(),
        }
    }

    pub fn stderr(status: i32, text: String) -> Self {
        Self {
            status,
            stdout: String::new(),
            stderr: text,
        }
    }
}

const TOP_LEVEL_HELP: &str = "\n  Usage: echarts [options] [command]\n\n  Offline knowledge CLI for Apache ECharts users\n\n\n  Options:\n\n    -h, --help  output usage information\n\n\n  Commands:\n\n    list [options]                  List ECharts charts, components, features, and renderers\n    info [options] <name>           Show metadata for a chart, component, feature, or renderer\n    example [options] <query> [id]  List matching examples or print a specific example source\n    option [options] [query...]     Inspect top-level option keys or option metadata for a specific item\n";

pub fn run<I>(argv: I) -> CliOutput
where
    I: IntoIterator<Item = String>,
{
    let args: Vec<String> = argv.into_iter().skip(1).collect();

    if args.is_empty() {
        return CliOutput::success();
    }

    match args[0].as_str() {
        "-h" | "--help" => CliOutput::stdout(TOP_LEVEL_HELP),
        flag if flag.starts_with('-') => unknown_option(flag),
        "list" => commands::list::run(&args[1..]),
        "info" => commands::info::run(&args[1..]),
        "example" => commands::example::run(&args[1..]),
        "option" => commands::option::run(&args[1..]),
        _ => CliOutput::success(),
    }
}

pub fn missing_required_argument(name: &str) -> CliOutput {
    CliOutput::stderr(
        1,
        format!("\n  error: missing required argument `{name}'\n\n"),
    )
}

pub fn missing_option_argument(flags: &str, got: Option<&str>) -> CliOutput {
    match got {
        Some(flag) => CliOutput::stderr(
            1,
            format!("\n  error: option `{flags}' argument missing, got `{flag}'\n\n"),
        ),
        None => CliOutput::stderr(
            1,
            format!("\n  error: option `{flags}' argument missing\n\n"),
        ),
    }
}

pub fn unknown_option(flag: &str) -> CliOutput {
    CliOutput::stderr(1, format!("\n  error: unknown option `{flag}'\n\n"))
}

#[cfg(test)]
mod tests {
    use super::{missing_option_argument, run, CliOutput};

    fn invoke(args: &[&str]) -> CliOutput {
        let argv = std::iter::once("echarts".to_string())
            .chain(args.iter().map(|value| (*value).to_string()));
        run(argv)
    }

    #[test]
    fn bare_cli_is_silent_success() {
        assert_eq!(invoke(&[]), CliOutput::success());
    }

    #[test]
    fn unknown_command_is_silent_success() {
        assert_eq!(invoke(&["nope"]), CliOutput::success());
    }

    #[test]
    fn top_level_help_matches_expected_output() {
        let output = invoke(&["--help"]);
        assert_eq!(output.status, 0);
        assert!(output.stdout.contains("Usage: echarts [options] [command]"));
        assert!(output.stderr.is_empty());
    }

    #[test]
    fn top_level_unknown_option_is_nonzero() {
        let output = invoke(&["--bogus"]);
        assert_eq!(output.status, 1);
        assert_eq!(output.stderr, "\n  error: unknown option `--bogus'\n\n");
    }

    #[test]
    fn missing_option_argument_matches_commander_shape() {
        assert_eq!(
            missing_option_argument("--format <format>", Some("--help")).stderr,
            "\n  error: option `--format <format>' argument missing, got `--help'\n\n"
        );
        assert_eq!(
            missing_option_argument("--format <format>", None).stderr,
            "\n  error: option `--format <format>' argument missing\n\n"
        );
    }
}
