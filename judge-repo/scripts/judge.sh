#!/bin/bash
set -e

SUBMISSION_ID="${SUBMISSION_ID}"
LANGUAGE="${LANGUAGE}"
SOURCE_FILE="${SOURCE_FILE}"
JUDGE_DATA="judge_data.json"

# Parse judge data - the API response wraps data in {"success":true,"data":{...}}
# Extract the inner data object
TIME_LIMIT=$(python3 -c "import json; d=json.load(open('$JUDGE_DATA')); inner=d.get('data',d); print(inner.get('problem',{}).get('time_limit',1000))")
MEMORY_LIMIT=$(python3 -c "import json; d=json.load(open('$JUDGE_DATA')); inner=d.get('data',d); print(inner.get('problem',{}).get('memory_limit',256))")
TESTCASES=$(python3 -c "import json; d=json.load(open('$JUDGE_DATA')); inner=d.get('data',d); print(len(inner.get('testcases',[])))")
JUDGE_TYPE=$(python3 -c "import json; d=json.load(open('$JUDGE_DATA')); inner=d.get('data',d); print(inner.get('problem',{}).get('judge_type','default'))")
SPJ_LANGUAGE=$(python3 -c "import json; d=json.load(open('$JUDGE_DATA')); inner=d.get('data',d); print(inner.get('problem',{}).get('spj_language',''))")
SPJ_CODE=$(python3 -c "import json; d=json.load(open('$JUDGE_DATA')); inner=d.get('data',d); print(inner.get('spj_code',''))")

echo "Judge config: time_limit=${TIME_LIMIT}ms, memory_limit=${MEMORY_LIMIT}MB, testcases=${TESTCASES}, judge_type=${JUDGE_TYPE}"
echo "Submission: id=${SUBMISSION_ID}, language=${LANGUAGE}, file=${SOURCE_FILE}"

WORK_DIR="/tmp/judge_${SUBMISSION_ID}"
mkdir -p "$WORK_DIR"

# Extract file extension from source file
SOURCE_EXT="${SOURCE_FILE##*.}"
if [ "$SOURCE_EXT" = "$SOURCE_FILE" ]; then
  SOURCE_EXT=""
fi
SOURCE_FILENAME="solution"
if [ -n "$SOURCE_EXT" ]; then
  SOURCE_FILENAME="solution.${SOURCE_EXT}"
fi
cp "$SOURCE_FILE" "$WORK_DIR/$SOURCE_FILENAME"
echo "Copied source file to $WORK_DIR/$SOURCE_FILENAME"

COMPILE_CMD=""
RUN_CMD=""

case "$LANGUAGE" in
  python)
    RUN_CMD="python3 $WORK_DIR/$SOURCE_FILENAME"
    ;;
  cpp)
    COMPILE_CMD="g++ -std=c++17 -O2 -o $WORK_DIR/solution_bin $WORK_DIR/$SOURCE_FILENAME"
    RUN_CMD="$WORK_DIR/solution_bin"
    ;;
  java)
    cp "$WORK_DIR/$SOURCE_FILENAME" "$WORK_DIR/Main.java"
    COMPILE_CMD="javac $WORK_DIR/Main.java"
    RUN_CMD="java -cp $WORK_DIR Main"
    ;;
  javascript)
    RUN_CMD="node $WORK_DIR/$SOURCE_FILENAME"
    ;;
  c)
    COMPILE_CMD="gcc -std=c11 -O2 -o $WORK_DIR/solution_bin $WORK_DIR/$SOURCE_FILENAME"
    RUN_CMD="$WORK_DIR/solution_bin"
    ;;
  go)
    cp "$WORK_DIR/$SOURCE_FILENAME" "$WORK_DIR/main.go"
    COMPILE_CMD="go build -o $WORK_DIR/solution_bin $WORK_DIR/main.go"
    RUN_CMD="$WORK_DIR/solution_bin"
    ;;
  rust)
    cp "$WORK_DIR/$SOURCE_FILENAME" "$WORK_DIR/main.rs"
    COMPILE_CMD="rustc -O -o $WORK_DIR/solution_bin $WORK_DIR/main.rs"
    RUN_CMD="$WORK_DIR/solution_bin"
    ;;
  *)
    echo "{\"submission_id\": \"$SUBMISSION_ID\", \"status\": \"system_error\", \"details\": [{\"status\": \"system_error\", \"message\": \"Unsupported language: $LANGUAGE\"}]}" > result.json
    exit 0
    ;;
esac

if [ -n "$COMPILE_CMD" ]; then
  echo "Compiling: $COMPILE_CMD"
  if ! eval "$COMPILE_CMD" 2>"$WORK_DIR/compile_error.txt"; then
    COMPILE_ERROR=$(head -c 1000 "$WORK_DIR/compile_error.txt")
    echo "{\"submission_id\": \"$SUBMISSION_ID\", \"status\": \"compile_error\", \"details\": [{\"status\": \"compile_error\", \"message\": $(echo "$COMPILE_ERROR" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}]}" > result.json
    rm -rf "$WORK_DIR"
    exit 0
  fi
  echo "Compilation successful"
fi

# Compile SPJ checker if judge_type is 'spj'
SPJ_CMD=""
if [ "$JUDGE_TYPE" = "spj" ]; then
  echo "Compiling SPJ checker (language: $SPJ_LANGUAGE)"

  # Determine SPJ source file extension
  case "$SPJ_LANGUAGE" in
    python) SPJ_EXT="py" ;;
    cpp) SPJ_EXT="cpp" ;;
    java) SPJ_EXT="java" ;;
    javascript) SPJ_EXT="js" ;;
    c) SPJ_EXT="c" ;;
    go) SPJ_EXT="go" ;;
    rust) SPJ_EXT="rs" ;;
    *) SPJ_EXT="txt" ;;
  esac

  SPJ_SOURCE="$WORK_DIR/spj_solution.$SPJ_EXT"
  printf '%s' "$SPJ_CODE" > "$SPJ_SOURCE"

  SPJ_COMPILE_CMD=""
  case "$SPJ_LANGUAGE" in
    python)
      SPJ_CMD="python3 $SPJ_SOURCE"
      ;;
    cpp)
      SPJ_COMPILE_CMD="g++ -std=c++17 -O2 -o $WORK_DIR/spj_bin $SPJ_SOURCE"
      SPJ_CMD="$WORK_DIR/spj_bin"
      ;;
    java)
      cp "$SPJ_SOURCE" "$WORK_DIR/SpjMain.java"
      SPJ_COMPILE_CMD="javac $WORK_DIR/SpjMain.java"
      SPJ_CMD="java -cp $WORK_DIR SpjMain"
      ;;
    javascript)
      SPJ_CMD="node $SPJ_SOURCE"
      ;;
    c)
      SPJ_COMPILE_CMD="gcc -std=c11 -O2 -o $WORK_DIR/spj_bin $SPJ_SOURCE"
      SPJ_CMD="$WORK_DIR/spj_bin"
      ;;
    go)
      cp "$SPJ_SOURCE" "$WORK_DIR/spj_main.go"
      SPJ_COMPILE_CMD="go build -o $WORK_DIR/spj_bin $WORK_DIR/spj_main.go"
      SPJ_CMD="$WORK_DIR/spj_bin"
      ;;
    rust)
      cp "$SPJ_SOURCE" "$WORK_DIR/spj_main.rs"
      SPJ_COMPILE_CMD="rustc -O -o $WORK_DIR/spj_bin $WORK_DIR/spj_main.rs"
      SPJ_CMD="$WORK_DIR/spj_bin"
      ;;
    *)
      echo "{\"submission_id\": \"$SUBMISSION_ID\", \"status\": \"system_error\", \"details\": [{\"status\": \"system_error\", \"message\": \"Unsupported SPJ language: $SPJ_LANGUAGE\"}]}" > result.json
      rm -rf "$WORK_DIR"
      exit 0
      ;;
  esac

  if [ -n "$SPJ_COMPILE_CMD" ]; then
    echo "Compiling SPJ: $SPJ_COMPILE_CMD"
    if ! eval "$SPJ_COMPILE_CMD" 2>"$WORK_DIR/spj_compile_error.txt"; then
      SPJ_COMPILE_ERROR=$(head -c 1000 "$WORK_DIR/spj_compile_error.txt")
      echo "{\"submission_id\": \"$SUBMISSION_ID\", \"status\": \"system_error\", \"details\": [{\"status\": \"system_error\", \"message\": $(echo "$SPJ_COMPILE_ERROR" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')}]}" > result.json
      rm -rf "$WORK_DIR"
      exit 0
    fi
    echo "SPJ compilation successful"
  fi
fi

TOTAL_SCORE=0
MAX_SCORE=0
MAX_TIME=0
MAX_MEMORY=0
OVERALL_STATUS="accepted"
DETAILS="["

for i in $(seq 0 $((TESTCASES - 1))); do
  INPUT=$(python3 -c "import json; d=json.load(open('$JUDGE_DATA')); inner=d.get('data',d); print(inner['testcases'][$i]['input'])")
  EXPECTED=$(python3 -c "import json; d=json.load(open('$JUDGE_DATA')); inner=d.get('data',d); print(inner['testcases'][$i]['expected_output'])")
  SCORE=$(python3 -c "import json; d=json.load(open('$JUDGE_DATA')); inner=d.get('data',d); print(inner['testcases'][$i].get('score',10))")
  IS_SAMPLE=$(python3 -c "import json; d=json.load(open('$JUDGE_DATA')); inner=d.get('data',d); print(json.dumps(inner['testcases'][$i].get('is_sample',0)))")

  MAX_SCORE=$((MAX_SCORE + SCORE))

  printf '%s' "$INPUT" > "$WORK_DIR/input.txt"
  printf '%s' "$EXPECTED" > "$WORK_DIR/expected.txt"

  TIME_LIMIT_SEC=$(python3 -c "print($TIME_LIMIT / 1000.0 + 0.5)")

  # Use /usr/bin/time to measure memory and time
  MEMORY_LOG="$WORK_DIR/memory.log"
  rm -f "$MEMORY_LOG"

  START_TIME=$(date +%s%N)
  set +e
  ulimit -v $((MEMORY_LIMIT * 1024)) 2>/dev/null || true
  /usr/bin/time -v bash -c "$RUN_CMD < $WORK_DIR/input.txt > $WORK_DIR/output.txt 2>$WORK_DIR/error.txt" 2> "$MEMORY_LOG"
  EXIT_CODE=$?
  set -e
  END_TIME=$(date +%s%N)
  ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))

  # Parse memory from /usr/bin/time output (Maximum resident set size in KB)
  MEMORY_USAGE=0
  if [ -f "$MEMORY_LOG" ]; then
    MEMORY_KB=$(grep "Maximum resident set size" "$MEMORY_LOG" | awk '{print $NF}')
    if [ -n "$MEMORY_KB" ]; then
      MEMORY_USAGE=$((MEMORY_KB / 1024))  # Convert KB to MB
    fi
  fi

  if [ $ELAPSED_MS -gt $MAX_TIME ]; then
    MAX_TIME=$ELAPSED_MS
  fi

  if [ $MEMORY_USAGE -gt $MAX_MEMORY ]; then
    MAX_MEMORY=$MEMORY_USAGE
  fi

  TC_STATUS=""
  TC_MESSAGE=""

  if [ $EXIT_CODE -eq 124 ]; then
    TC_STATUS="time_limit_exceeded"
    TC_MESSAGE="Time limit exceeded (${ELAPSED_MS}ms > ${TIME_LIMIT}ms)"
    OVERALL_STATUS="time_limit_exceeded"
  elif [ $EXIT_CODE -ne 0 ]; then
    TC_STATUS="runtime_error"
    ERROR_MSG=$(head -c 500 "$WORK_DIR/error.txt" 2>/dev/null || echo "Unknown error")
    TC_MESSAGE="Runtime error (exit code $EXIT_CODE): $ERROR_MSG"
    OVERALL_STATUS="runtime_error"
  else
    if [ "$JUDGE_TYPE" = "spj" ]; then
      # Run SPJ checker: spj_cmd <input_file> <output_file> <expected_output_file>
      # Ensure expected.txt exists even if empty
      touch "$WORK_DIR/expected.txt"
      set +e
      $SPJ_CMD "$WORK_DIR/input.txt" "$WORK_DIR/output.txt" "$WORK_DIR/expected.txt" 2>"$WORK_DIR/spj_error.txt"
      SPJ_EXIT_CODE=$?
      set -e

      if [ $SPJ_EXIT_CODE -eq 0 ]; then
        TC_STATUS="accepted"
        TOTAL_SCORE=$((TOTAL_SCORE + SCORE))
      elif [ $SPJ_EXIT_CODE -eq 1 ]; then
        TC_STATUS="wrong_answer"
        SPJ_MSG=$(head -c 500 "$WORK_DIR/spj_error.txt" 2>/dev/null || echo "Wrong answer")
        TC_MESSAGE="SPJ: $SPJ_MSG"
        if [ "$OVERALL_STATUS" = "accepted" ]; then
          OVERALL_STATUS="wrong_answer"
        fi
      else
        TC_STATUS="system_error"
        TC_MESSAGE="SPJ checker error (exit code $SPJ_EXIT_CODE)"
        OVERALL_STATUS="system_error"
      fi
    else
      ACTUAL=$(cat "$WORK_DIR/output.txt")
      EXPECTED_TRIMMED=$(python3 -c "
expected = open('$WORK_DIR/expected.txt').read()
actual = open('$WORK_DIR/output.txt').read()
if expected.strip() == actual.strip():
    print('MATCH')
else:
    print('MISMATCH')
")
      if [ "$EXPECTED_TRIMMED" = "MATCH" ]; then
        TC_STATUS="accepted"
        TOTAL_SCORE=$((TOTAL_SCORE + SCORE))
      else
        TC_STATUS="wrong_answer"
        TC_MESSAGE="Output differs from expected"
        if [ "$OVERALL_STATUS" = "accepted" ]; then
          OVERALL_STATUS="wrong_answer"
        fi
      fi
    fi
  fi

  echo "Testcase $((i+1))/$TESTCASES: $TC_STATUS (${ELAPSED_MS}ms)"

  if [ $i -gt 0 ]; then
    DETAILS+=","
  fi
  DETAILS+="{\"status\":\"$TC_STATUS\",\"time_used\":$ELAPSED_MS,\"memory_used\":$MEMORY_USAGE,\"score\":$([ "$TC_STATUS" = "accepted" ] && echo $SCORE || echo 0),\"is_sample\":$IS_SAMPLE"
  if [ -n "$TC_MESSAGE" ]; then
    DETAILS+=",\"message\":$(echo "$TC_MESSAGE" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')"
  fi
  DETAILS+="}"
done

DETAILS+="]"

echo "{\"submission_id\":\"$SUBMISSION_ID\",\"status\":\"$OVERALL_STATUS\",\"score\":$TOTAL_SCORE,\"time_used\":$MAX_TIME,\"memory_used\":$MAX_MEMORY,\"details\":$DETAILS}" > result.json

echo "Judge completed: status=$OVERALL_STATUS, score=$TOTAL_SCORE/$MAX_SCORE"

rm -rf "$WORK_DIR"
