use std::collections::HashSet;
use std::env;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

static PACKAGE_ROOT_CACHE: OnceLock<Result<PathBuf, String>> = OnceLock::new();

pub fn package_root() -> Result<PathBuf, String> {
    PACKAGE_ROOT_CACHE
        .get_or_init(|| {
            let mut seen = HashSet::new();
            let mut candidates = Vec::new();

            if let Ok(current_dir) = env::current_dir() {
                for candidate in climb(&current_dir) {
                    if seen.insert(candidate.clone()) {
                        candidates.push(candidate);
                    }
                }
            }

            if let Ok(current_exe) = env::current_exe() {
                if let Some(parent) = current_exe.parent() {
                    for candidate in climb(parent) {
                        if seen.insert(candidate.clone()) {
                            candidates.push(candidate);
                        }
                    }
                }
            }

            for candidate in candidates {
                if candidate.join("data").join("metadata.json").exists()
                    || (candidate.join("package.json").exists()
                        && candidate.join("scripts").join("build-data.js").exists()
                        && candidate.join("bin").join("echarts.js").exists())
                {
                    return Ok(candidate);
                }
            }

            Err("Unable to locate packaged echarts-cli data root.".to_string())
        })
        .clone()
}

pub fn build_search_candidates(explicit: Option<&str>, start_dir: Option<&Path>) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut candidates = Vec::new();

    if let Some(explicit_root) = explicit.filter(|value| !value.is_empty()) {
        let explicit_path = PathBuf::from(explicit_root);
        for candidate in climb(&explicit_path) {
            if seen.insert(candidate.clone()) {
                candidates.push(candidate);
            }
        }
    }

    if let Some(start) = start_dir {
        for candidate in climb(start) {
            if seen.insert(candidate.clone()) {
                candidates.push(candidate);
            }
        }
    }

    candidates
}

pub fn resolve_website_root(start_dir: Option<&Path>) -> Option<PathBuf> {
    let explicit = env::var("ECHARTS_CLI_WEBSITE_ROOT").ok();
    for candidate in build_search_candidates(explicit.as_deref(), start_dir) {
        for possible_root in [candidate.clone(), candidate.join("echarts-website")] {
            if possible_root
                .join("zh")
                .join("documents")
                .join("option.json")
                .exists()
                && possible_root
                    .join("en")
                    .join("documents")
                    .join("option.json")
                    .exists()
                && possible_root
                    .join("zh")
                    .join("documents")
                    .join("tutorial-parts")
                    .join("tutorial.json")
                    .exists()
                && possible_root
                    .join("en")
                    .join("documents")
                    .join("tutorial-parts")
                    .join("tutorial.json")
                    .exists()
            {
                return Some(possible_root);
            }
        }
    }
    None
}

pub fn normalize_name(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(|character| character.to_lowercase())
        .collect()
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
