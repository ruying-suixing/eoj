export const LANGUAGES = [
  { value: 'python', label: 'Python 3' },
  { value: 'cpp', label: 'C++' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript (Node.js)' },
  { value: 'c', label: 'C' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
];

export const DEFAULT_CODE: Record<string, string> = {
  python: `# Write your solution here
def solve():
    pass

if __name__ == "__main__":
    import sys
    input = sys.stdin.read()
    print(solve())
`,
  cpp: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);
    
    return 0;
}
`,
  java: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
    }
}
`,
  javascript: `// Write your solution here
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Implement solution
`,
  c: `#include <stdio.h>

int main() {
    return 0;
}
`,
  go: `package main

import (
    "fmt"
)

func main() {
}
`,
  rust: `use std::io;

fn main() {
    let mut input = String::new();
    io::stdin().read_line(&mut input).unwrap();
}
`,
};

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#4ade80',
  Medium: '#fbbf24',
  Hard: '#ef4444',
};

export const LANGUAGE_EXTENSIONS: Record<string, any> = {
  python: 'python',
  cpp: 'cpp',
  java: 'java',
  javascript: 'javascript',
  c: 'c',
  go: 'go',
  rust: 'rust',
};

export const LANGUAGE_TEMPLATES = DEFAULT_CODE;
