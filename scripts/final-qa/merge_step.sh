#!/usr/bin/env bash
# One step of MERGE_EXECUTION.md (PO approved 12/11/2026). Stops on the first failed check.
# usage: merge_step.sh STEP PR|create HEAD_SHA PREV_SHA COMMITS FILES [BRANCH TITLE BODY]
set -uo pipefail
STEP=$1; PR=$2; HEAD=$3; PREV=$4; COMMITS=$5; FILES=$6
LOG=/private/tmp/claude-501/-Users-quoctuan8386-Documents-JKC-AI-AGENT-PROJECT/627a0c55-ac71-4730-9f53-5b21cbf4ba33/scratchpad/merge-log-8-9.md
# Read-only GitHub calls retry on transient network errors; state-changing calls (create/edit/ready/merge) run once.
ghr() { local out i; for i in 1 2 3 4 5 6; do out=$(gh "$@" 2>/dev/null) && [ -n "$out" ] && { printf '%s\n' "$out"; return 0; }; sleep 10; done; return 1; }
stop() { echo "STOP step $STEP: $1"; echo "| $STEP | ${PR} | \`${HEAD:0:7}\` | — | — | ❌ DỪNG: $1 |" >> $LOG; exit 1; }
cd /Users/quoctuan8386/Documents/JKC_AI_AGENT_PROJECT
for i in 1 2 3 4 5 6; do git fetch -q origin --prune && break; sleep 10; done
echo "a. main tree == PREV ${PREV:0:7}"
git diff --quiet "$PREV" origin/main || stop "main tree differs from PREV"
MAIN_BEFORE=$(git rev-parse origin/main)
if [ "$PR" = create ]; then
  BR=$7; TITLE=$8; BODY=$9
  [ "$(git rev-parse "origin/$BR")" = "$HEAD" ] || stop "origin/$BR is not $HEAD"
  URL=$(gh pr create --base main --head "$BR" --title "$TITLE" --body "$BODY") || stop "gh pr create failed"
  PR=${URL##*/}; echo "b. created PR #$PR $URL"
else
  echo "c. retarget #$PR to main"
  for i in 1 2 3 4 5 6; do
    gh pr edit "$PR" --base main >/dev/null 2>&1
    [ "$(ghr pr view "$PR" --json baseRefName --jq .baseRefName)" = main ] && break; sleep 15
  done
  [ "$(ghr pr view "$PR" --json baseRefName --jq .baseRefName)" = main ] || stop "gh pr edit --base main failed"
fi
sleep 8
for i in 1 2 3 4 5 6; do
  V=$(ghr pr view "$PR" --json headRefOid,baseRefName,commits,changedFiles,mergeStateStatus,isDraft --jq '"\(.headRefOid) \(.baseRefName) \(.commits|length) \(.changedFiles) \(.mergeStateStatus) \(.isDraft)"')
  read -r H B C F ST DR <<<"$V"
  [ "$ST" = UNKNOWN ] && { sleep 10; continue; }; break
done
echo "d. PR #$PR: head=${H:0:7} base=$B commits=$C files=$F state=$ST draft=$DR"
[ "$H" = "$HEAD" ] || stop "PR head $H != $HEAD"
[ "$B" = main ] || stop "base $B"
[ "$C" = "$COMMITS" ] || stop "commits $C != $COMMITS"
[ "$F" = "$FILES" ] || stop "files $F != $FILES"
if [ "$DR" = true ]; then
  [ "$ST" = DRAFT ] || [ "$ST" = CLEAN ] || stop "state $ST before ready"
  echo "e. ready #$PR"
  for i in 1 2 3 4 5 6; do
    gh pr ready "$PR" >/dev/null 2>&1
    [ "$(ghr pr view "$PR" --json isDraft --jq .isDraft)" = false ] && break; sleep 15
  done
  [ "$(ghr pr view "$PR" --json isDraft --jq .isDraft)" = false ] || stop "gh pr ready failed"
  sleep 8
  for i in 1 2 3 4 5 6; do ST=$(ghr pr view "$PR" --json mergeStateStatus --jq .mergeStateStatus); [ "$ST" = UNKNOWN ] && sleep 10 || break; done
fi
if [ "$ST" = BLOCKED ]; then
  # Opening/readying a PR triggers a pull_request CI run on the same head; protection waits for it.
  echo "   BLOCKED: waiting for required checks of PR #$PR (no bypass)"
  for i in $(seq 1 60); do
    PEND=$(ghr pr view "$PR" --json statusCheckRollup --jq '[.statusCheckRollup[]|select(.status!="COMPLETED")]|length')
    [ "$PEND" = 0 ] && break; sleep 30
  done
  BADC=$(ghr pr view "$PR" --json statusCheckRollup --jq '[.statusCheckRollup[]|select(.conclusion!="SUCCESS")|.name]|join(",")')
  [ -z "$BADC" ] || stop "PR checks not green: $BADC"
  PRRUN=$(ghr pr view "$PR" --json statusCheckRollup --jq '[.statusCheckRollup[]|.detailsUrl|capture("runs/(?<r>[0-9]+)").r]|unique|join(",")')
  echo "   PR checks green (runs $PRRUN)"
  sleep 5; ST=$(ghr pr view "$PR" --json mergeStateStatus --jq .mergeStateStatus)
fi
[ "$ST" = CLEAN ] || stop "mergeStateStatus $ST (expected CLEAN)"
echo "merge #$PR (merge commit, match head $HEAD)"
if ! gh pr merge "$PR" --merge --match-head-commit "$HEAD"; then
  # Network errors can hide a merge that GitHub already performed: trust only the server state.
  echo "   gh pr merge returned an error; reading PR state from GitHub"
  sleep 20
  MS=$(ghr pr view "$PR" --json state,headRefOid,mergeCommit --jq '"\(.state) \(.headRefOid) \(.mergeCommit.oid)"') || stop "gh pr merge failed and state unreadable"
  read -r MST MH MC <<<"$MS"
  [ "$MST" = MERGED ] && [ "$MH" = "$HEAD" ] && [ -n "$MC" ] || stop "gh pr merge failed (server state: $MS)"
  echo "   server confirms MERGED as $MC (client error ignored; verification continues)"
fi
sleep 5; for i in 1 2 3 4 5 6; do git fetch -q origin && break; sleep 10; done
M=$(git rev-parse origin/main)
P=$(git log -1 --format=%P origin/main)
echo "f. main=$M parents=$P"
[ "$P" = "$MAIN_BEFORE $HEAD" ] || stop "parents '$P' != '$MAIN_BEFORE $HEAD'"
if [ -n "${EXPECT_TREE:-}" ]; then
  [ "$(git rev-parse origin/main^{tree})" = "$EXPECT_TREE" ] || stop "main tree $(git rev-parse origin/main^{tree}) != expected $EXPECT_TREE"
  TREENOTE="cây = tổ hợp đã thử \`${EXPECT_TREE:0:7}\`"
else
  git diff --quiet "$HEAD" origin/main || stop "main tree != $HEAD tree"
  TREENOTE="cây = head"
fi
[ "$(ghr pr view "$PR" --json state --jq .state)" = MERGED ] || stop "PR not MERGED"
echo "g. waiting for CI push run on $M"
RUN=""
for i in $(seq 1 30); do RUN=$(ghr run list --branch main --event push --limit 10 --json databaseId,headSha --jq ".[]|select(.headSha==\"$M\")|.databaseId" | head -1); [ -n "$RUN" ] && break; sleep 10; done
[ -n "$RUN" ] || stop "no CI run for merge commit $M"
for i in $(seq 1 90); do
  RS=$(ghr run view "$RUN" --json status --jq .status) || RS=unknown
  [ "$RS" = completed ] && break; sleep 20
done
[ "$RS" = completed ] || stop "CI run $RUN not completed (status $RS)"
JOBS=$(ghr run view "$RUN" --json jobs --jq '[.jobs[]|"\(.name)=\(.conclusion)"]|sort|join(" ")')
echo "   run $RUN: $JOBS"
[ "$JOBS" = "foundation=success postgres17=success staging-acceptance=success" ] || { echo "| $STEP | #$PR | \`${HEAD:0:7}\` | \`${M:0:7}\` | $RUN | ❌ CI: $JOBS |" >> $LOG; stop "CI on main: $JOBS"; }
echo "| $STEP | #$PR | \`${HEAD:0:7}\` | \`${M:0:7}\` | [$RUN](https://github.com/tuanqt98/TriThucJKC/actions/runs/$RUN) | ✅ cha = \`${MAIN_BEFORE:0:7}\` + \`${HEAD:0:7}\`; $TREENOTE; $C commit, $F file; CI 3/3 ($(date -u +%H:%MZ)) |" >> $LOG
echo "STEP $STEP OK: PR #$PR merged as ${M:0:7}, CI run $RUN green"
