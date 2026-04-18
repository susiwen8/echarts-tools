pub fn normalize_name(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

pub fn tokenize(value: &str) -> Vec<String> {
    let mut normalized = String::with_capacity(value.len() * 2);
    let chars = value.chars().collect::<Vec<_>>();
    for (index, ch) in chars.iter().enumerate() {
        if index > 0 {
            let prev = chars[index - 1];
            if prev.is_ascii_alphanumeric() && ch.is_ascii_uppercase() {
                normalized.push(' ');
            }
        }
        normalized.push(*ch);
    }

    normalized
        .split(|ch: char| !ch.is_ascii_alphanumeric())
        .filter(|token| !token.trim().is_empty())
        .map(|token| token.trim().to_ascii_lowercase())
        .collect()
}

pub fn humanize(value: &str) -> String {
    tokenize(value)
        .into_iter()
        .map(|token| {
            let mut chars = token.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn camel_to_kebab(value: &str) -> String {
    tokenize(value).join("-")
}

pub fn pascal_to_camel(value: &str) -> String {
    if value.is_empty() {
        return String::new();
    }

    let chars = value.chars().collect::<Vec<_>>();
    let mut prefix_len = 0;
    while prefix_len < chars.len() && chars[prefix_len].is_ascii_uppercase() {
        let next = chars.get(prefix_len + 1);
        if next.is_some_and(|next| next.is_ascii_lowercase()) && prefix_len > 0 {
            break;
        }
        prefix_len += 1;
    }

    if prefix_len == 0 {
        prefix_len = 1;
    }

    let mut result = String::new();
    for ch in chars[..prefix_len].iter() {
        result.push(ch.to_ascii_lowercase());
    }
    for ch in chars[prefix_len..].iter() {
        result.push(*ch);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::{camel_to_kebab, humanize, normalize_name, pascal_to_camel, tokenize};

    #[test]
    fn normalizes_names() {
        assert_eq!(normalize_name("xAxis.type"), "xaxistype");
    }

    #[test]
    fn tokenizes_camel_case() {
        assert_eq!(tokenize("lineSimpleDemo"), vec!["line", "simple", "demo"]);
    }

    #[test]
    fn humanizes_tokens() {
        assert_eq!(humanize("line-simple_demo"), "Line Simple Demo");
    }

    #[test]
    fn camel_to_kebab_converts_words() {
        assert_eq!(camel_to_kebab("axisPointer"), "axis-pointer");
    }

    #[test]
    fn converts_pascal_to_camel() {
        assert_eq!(pascal_to_camel("LineChart"), "lineChart");
        assert_eq!(pascal_to_camel("SVGRenderer"), "svgRenderer");
    }
}
