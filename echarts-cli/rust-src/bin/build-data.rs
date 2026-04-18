#[path = "../build_data/mod.rs"]
mod build_data;
#[allow(dead_code)]
#[path = "../models.rs"]
mod models;

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

fn main() -> ExitCode {
    match run() {
        Ok(code) => ExitCode::from(code),
        Err(error) => {
            eprintln!("{error}");
            ExitCode::from(1)
        }
    }
}

fn run() -> Result<u8, String> {
    let root = package_root()?;
    let out_dir = root.join("data");
    let out_file = root.join("data").join("metadata.json");
    let docs_out_dir = out_dir.join("docs");

    if !out_file.exists() {
        return Err(
            "Bundled data/metadata.json is required; source-repository generation is intentionally unsupported."
                .to_string(),
        );
    }

    let mut metadata_value: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(&out_file)
            .map_err(|error| format!("Failed to read {}: {error}", out_file.display()))?,
    )
    .map_err(|error| format!("Failed to parse {}: {error}", out_file.display()))?;

    let website_root = resolve_website_root(&root);
    let examples_root = resolve_examples_root(&root);

    let copied_docs_count = build_data::docs_subset::copy_docs_subset(
        &metadata_value,
        website_root.as_deref(),
        &docs_out_dir,
    )?;
    let split_examples_count = if metadata_value.get("examples").and_then(|value| value.as_array()).is_some()
    {
        build_data::example_packaging::split_example_content(
            &mut metadata_value,
            &out_dir,
            examples_root.as_deref(),
        )?
    } else {
        0
    };

    if let Some(object) = metadata_value.as_object_mut() {
        object.insert(
            "docsRoot".to_string(),
            serde_json::Value::String("data/docs".to_string()),
        );
    }

    fs::create_dir_all(&out_dir)
        .map_err(|error| format!("Failed to create {}: {error}", out_dir.display()))?;
    fs::write(
        &out_file,
        serde_json::to_string_pretty(&metadata_value)
            .map_err(|error| format!("Failed to serialize {}: {error}", out_file.display()))?,
    )
    .map_err(|error| format!("Failed to write {}: {error}", out_file.display()))?;

    println!("Wrote {}", out_file.display());
    if copied_docs_count > 0 {
        println!(
            "Copied {} built doc artifacts to {}",
            copied_docs_count,
            docs_out_dir.display()
        );
    }
    if split_examples_count > 0 {
        println!(
            "Copied {} example sources to {}",
            split_examples_count,
            out_dir.join("examples").display()
        );
    }

    Ok(0)
}

fn package_root() -> Result<PathBuf, String> {
    let mut candidates = Vec::new();

    if let Ok(current_dir) = env::current_dir() {
        candidates.extend(climb(&current_dir));
    }

    if let Ok(current_exe) = env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            candidates.extend(climb(parent));
        }
    }

    candidates
        .into_iter()
        .find(|candidate| candidate.join("package.json").exists() && candidate.join("data").exists())
        .ok_or_else(|| "Unable to locate echarts-cli package root.".to_string())
}

fn resolve_website_root(start_dir: &Path) -> Option<PathBuf> {
    let explicit = env::var("ECHARTS_CLI_WEBSITE_ROOT").ok();
    for candidate in build_search_candidates(explicit.as_deref(), start_dir) {
        for possible_root in [candidate.clone(), candidate.join("echarts-website")] {
            if possible_root.join("zh/documents/option.json").exists()
                && possible_root.join("en/documents/option.json").exists()
                && possible_root
                    .join("zh/documents/tutorial-parts/tutorial.json")
                    .exists()
                && possible_root
                    .join("en/documents/tutorial-parts/tutorial.json")
                    .exists()
            {
                return Some(possible_root);
            }
        }
    }
    None
}

fn resolve_examples_root(start_dir: &Path) -> Option<PathBuf> {
    let explicit = env::var("ECHARTS_CLI_EXAMPLES_ROOT").ok();
    for candidate in build_search_candidates(explicit.as_deref(), start_dir) {
        for possible_root in [
            candidate.clone(),
            candidate.join("echarts-example"),
            candidate.join("echarts-examples"),
        ] {
            if possible_root.join("public/examples/ts").exists() {
                return Some(possible_root);
            }
        }
    }
    None
}

fn build_search_candidates(explicit: Option<&str>, start_dir: &Path) -> Vec<PathBuf> {
    let mut seen = Vec::new();
    let mut add = |path: PathBuf| {
        if !seen.iter().any(|existing| existing == &path) {
            seen.push(path);
        }
    };

    if let Some(explicit) = explicit.filter(|value| !value.is_empty()) {
        for candidate in climb(Path::new(explicit)) {
            add(candidate);
        }
    }
    for candidate in climb(start_dir) {
        add(candidate);
    }
    seen
}

fn climb(start: &Path) -> Vec<PathBuf> {
    let mut current = start.to_path_buf();
    let mut results = Vec::new();
    loop {
        results.push(current.clone());
        if !current.pop() {
            break;
        }
    }
    results
}
