use std::fs;
use std::path::Path;

const MAPBOX_ACCESS_TOKEN_PREFIX: &str = "pk.";

fn packaged_content_path(relative_path: &str) -> String {
    if relative_path.ends_with(".js") || relative_path.ends_with(".ts") {
        format!("examples/{}.txt", relative_path)
    } else {
        format!("examples/{relative_path}")
    }
}

fn normalize_content_path(content_path: &str) -> String {
    if content_path.ends_with(".js") || content_path.ends_with(".ts") {
        format!("{content_path}.txt")
    } else {
        content_path.to_string()
    }
}

pub fn split_example_content(
    metadata: &mut serde_json::Value,
    out_dir: &Path,
    examples_source_root: Option<&Path>,
) -> Result<usize, String> {
    let examples = metadata
        .get_mut("examples")
        .and_then(|value| value.as_array_mut())
        .ok_or_else(|| "metadata.examples must be an array".to_string())?;

    let mut written = 0;
    for example in examples.iter_mut() {
        let relative_path = example
            .get("relativePath")
            .and_then(|value| value.as_str());
        let content_path = example
            .get("contentPath")
            .and_then(|value| value.as_str())
            .map(normalize_content_path)
            .or_else(|| relative_path.map(packaged_content_path));

        let content = if let Some(content) = example.get("content").and_then(|value| value.as_str()) {
            Some(sanitize_example_content(content))
        } else if let (Some(source_root), Some(relative_path)) = (examples_source_root, relative_path)
        {
            let source_path = source_root.join(relative_path);
            if source_path.exists() {
                Some(sanitize_example_content(
                    &fs::read_to_string(&source_path).map_err(|error| {
                        format!("Failed to read {}: {error}", source_path.display())
                    })?,
                ))
            } else {
                None
            }
        } else {
            None
        };

        if let (Some(content), Some(content_path)) = (content, content_path.as_ref()) {
            let destination = out_dir.join(content_path);
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("Failed to create {}: {error}", parent.display()))?;
            }
            fs::write(&destination, content)
                .map_err(|error| format!("Failed to write {}: {error}", destination.display()))?;
            written += 1;
        }

        if let Some(object) = example.as_object_mut() {
            object.remove("content");
            if let Some(content_path) = content_path {
                object.insert(
                    "contentPath".to_string(),
                    serde_json::Value::String(content_path),
                );
            }
        }
    }

    Ok(written)
}

fn sanitize_example_content(content: &str) -> String {
    let mut result = String::new();
    let mut index = 0;
    while index < content.len() {
        if content[index..].starts_with(MAPBOX_ACCESS_TOKEN_PREFIX) {
            let tail = &content[index + MAPBOX_ACCESS_TOKEN_PREFIX.len()..];
            let token_len = tail
                .chars()
                .take_while(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-'))
                .count();
            if token_len >= 20 {
                result.push_str("<MAPBOX_ACCESS_TOKEN>");
                index += MAPBOX_ACCESS_TOKEN_PREFIX.len() + token_len;
                continue;
            }
        }

        let ch = content[index..].chars().next().unwrap();
        result.push(ch);
        index += ch.len_utf8();
    }
    result
}

#[cfg(test)]
mod tests {
    use std::env;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{normalize_content_path, packaged_content_path, split_example_content};

    #[test]
    fn splits_example_content_into_files() {
        let root = env::temp_dir().join(format!(
            "echarts-cli-example-packaging-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();

        let mut metadata = serde_json::json!({
            "examples": [
                {
                    "id": "line-simple",
                    "relativePath": "public/examples/ts/line-simple.ts",
                    "content": "const option = { series: [{ type: 'line' }] };"
                }
            ]
        });

        let written = split_example_content(&mut metadata, &root, None).unwrap();
        assert_eq!(written, 1);
        assert_eq!(metadata["examples"][0]["content"], serde_json::Value::Null);
        assert_eq!(
            metadata["examples"][0]["contentPath"],
            serde_json::Value::String("examples/public/examples/ts/line-simple.ts.txt".to_string())
        );
        assert!(root
            .join("examples/public/examples/ts/line-simple.ts.txt")
            .exists());

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn redacts_mapbox_tokens_when_splitting() {
        let root = env::temp_dir().join(format!(
            "echarts-cli-example-packaging-redact-{}",
            SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();

        let mut metadata = serde_json::json!({
            "examples": [
                {
                    "id": "bar3d-on-mapbox",
                    "relativePath": "public/examples/ts/gl/bar3d-on-mapbox.js",
                    "content": "const token = 'pk.abcdefghijklmnopqrstuvwxyz0123456789ABCD';"
                }
            ]
        });

        split_example_content(&mut metadata, &root, None).unwrap();
        const OUTPUT_PATH: &str = "examples/public/examples/ts/gl/bar3d-on-mapbox.js.txt";
        let output = fs::read_to_string(root.join(OUTPUT_PATH)).unwrap();
        assert!(!output.contains("pk.abcdefghijklmnopqrstuvwxyz0123456789ABCD"));
        assert!(output.contains("<MAPBOX_ACCESS_TOKEN>"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rewrites_js_examples_to_non_js_packaged_paths() {
        assert_eq!(
            packaged_content_path("public/examples/ts/geo-lines.js"),
            "examples/public/examples/ts/geo-lines.js.txt"
        );
        assert_eq!(
            packaged_content_path("public/examples/ts/line-simple.ts"),
            "examples/public/examples/ts/line-simple.ts.txt"
        );
        assert_eq!(
            normalize_content_path("examples/public/examples/ts/geo-lines.js"),
            "examples/public/examples/ts/geo-lines.js.txt"
        );
        assert_eq!(
            normalize_content_path("examples/public/examples/ts/line-simple.ts"),
            "examples/public/examples/ts/line-simple.ts.txt"
        );
    }

    #[test]
    fn rebuilds_packaged_examples_from_source_checkout_when_content_is_already_split() {
        let root = env::temp_dir().join(format!(
            "echarts-cli-example-packaging-rebuild-{}",
            SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let examples_source = root.join("examples-source");
        fs::create_dir_all(examples_source.join("public/examples/ts")).unwrap();
        fs::write(
            examples_source.join("public/examples/ts/line-simple.ts"),
            "const option = { series: [{ type: 'line' }] };",
        )
        .unwrap();

        let mut metadata = serde_json::json!({
            "examples": [
                {
                    "id": "line-simple",
                    "relativePath": "public/examples/ts/line-simple.ts",
                    "contentPath": "examples/public/examples/ts/line-simple.ts"
                }
            ]
        });

        let written = split_example_content(&mut metadata, &root, Some(&examples_source)).unwrap();
        assert_eq!(written, 1);
        assert!(root
            .join("examples/public/examples/ts/line-simple.ts.txt")
            .exists());

        fs::remove_dir_all(root).unwrap();
    }
}
