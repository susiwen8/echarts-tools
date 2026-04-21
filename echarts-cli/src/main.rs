mod cli;
mod commands;
mod data;
mod doc_utils;
mod models;
mod output;
mod shared;

fn main() {
    let outcome = cli::run(std::env::args());

    if !outcome.stdout.is_empty() {
        print!("{}", outcome.stdout);
    }
    if !outcome.stderr.is_empty() {
        eprint!("{}", outcome.stderr);
    }

    std::process::exit(outcome.status);
}
