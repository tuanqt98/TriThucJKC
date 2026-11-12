#!/usr/bin/env bash
# Read-only preflight for the main merge (MERGE_PLAN option A, adjusted to 8 steps by PO decision B). Never merges, edits or pushes.
# Exit 0 only if every condition holds. Usage: scripts/final-qa/merge_preflight.sh
set -uo pipefail
REPO=tuanqt98/TriThucJKC
fail=0
ok() { printf '  ✅ %s\n' "$1"; }
bad() { printf '  ❌ %s\n' "$1"; fail=1; }
git fetch -q origin --tags

echo "1. Locked SHAs (origin) and CI on each head"
steps=(
  "main dc47e98"
  "feature/sprint-1-mvp 461a19a"
  "feature/ui-documents-fidelity 30aaf53"
  "feature/ui-document-detail 5348aff"
  "feature/ui-knowledge-library 08e337e"
  "feature/ui-knowledge-detail a3c3b93"
  "feature/ui-incident-detail e2bcaba"
  "feature/ui-knowledge-create 5a3af00"
  "feature/ui-my-courses 6fabca0"
  "feature/ui-approvals 47597a6"
)
prev=""
for s in "${steps[@]}"; do
  b=${s% *}; want=${s#* }
  got=$(git rev-parse --short=7 "origin/$b" 2>/dev/null)
  [ "$got" = "$want" ] && ok "$b = $want" || bad "$b is $got, expected $want"
  if [ "$b" != main ]; then
    full=$(git rev-parse "origin/$b")
    ci=$(gh api "repos/$REPO/commits/$full/check-runs?per_page=50" --jq '[.check_runs[]|select(.name=="foundation" or .name=="postgres17" or .name=="staging-acceptance")|select(.conclusion=="success")|.name]|unique|length')
    [ "$ci" = 3 ] && ok "   CI 3/3 green on $want" || bad "   CI green jobs on $want: $ci/3"
    git merge-base --is-ancestor "$prev" "$full" && ok "   $prev is ancestor (linear stack)" || bad "   $prev is NOT an ancestor of $want"
  fi
  prev=$(git rev-parse "origin/$b")
done

echo "2. Rehearsal: tree of last head equals dry-run snapshot a5b8ee8"
git diff --quiet 47597a6 a5b8ee8 && ok "tree(47597a6) == tree(a5b8ee8)" || bad "trees differ"

echo "3. Tags"
[ "$(git rev-parse 'pre-merge-main-20261111^{commit}' 2>/dev/null | cut -c1-7)" = dc47e98 ] && ok "pre-merge-main-20261111 -> dc47e98" || bad "pre-merge tag missing/wrong"
[ "$(git rev-parse 'ui-09-approved^{commit}' 2>/dev/null | cut -c1-7)" = 47597a6 ] && ok "ui-09-approved -> 47597a6" || bad "ui-09-approved missing/wrong"
[ "$(git rev-parse 'ui-08-approved^{commit}' 2>/dev/null | cut -c1-7)" = 6fabca0 ] && ok "ui-08-approved -> 6fabca0" || bad "ui-08-approved missing/wrong"

echo "4. Branch protection on main and merge settings"
p=$(gh api "repos/$REPO/branches/main/protection" 2>/dev/null)
[ -n "$p" ] || bad "protection not readable"
[ "$(jq -r '[.required_status_checks.checks[].context]|sort|join(",")' <<<"$p")" = "foundation,postgres17,staging-acceptance" ] && ok "required checks: foundation, postgres17, staging-acceptance" || bad "required checks differ"
[ "$(jq -r .required_pull_request_reviews.required_approving_review_count <<<"$p")" = 0 ] && ok "PR required (0 approvals)" || bad "PR rule differs"
[ "$(jq -r .enforce_admins.enabled <<<"$p")" = true ] && ok "enforced for admins" || bad "admins not enforced"
[ "$(jq -r .allow_force_pushes.enabled <<<"$p")" = false ] && ok "force-push blocked" || bad "force-push allowed"
[ "$(jq -r .allow_deletions.enabled <<<"$p")" = false ] && ok "deletion blocked" || bad "deletion allowed"
[ "$(jq -r .required_linear_history.enabled <<<"$p")" = false ] && ok "linear history not required (merge commits allowed)" || bad "linear history required"
r=$(gh api "repos/$REPO" --jq '"\(.allow_merge_commit) \(.allow_squash_merge) \(.allow_rebase_merge) \(.delete_branch_on_merge)"')
[ "$r" = "true false false false" ] && ok "merge commit only; branches kept after merge" || bad "repo merge settings: $r"

echo "5. No auto-deploy"
[ "$(git ls-tree --name-only -r origin/feature/ui-approvals .github/workflows)" = ".github/workflows/ci.yml" ] && ok "only ci.yml workflow" || bad "other workflows present"
git show origin/feature/ui-approvals:.github/workflows/ci.yml | grep -qiE 'environment:|deploy[^/]|ssh |kubectl|docker push|docker login' && bad "deploy-like steps in ci.yml" || ok "ci.yml has no deploy/push steps (the deploy/compose.yml stacks are ephemeral, inside the CI runner)"
[ "$(gh api "repos/$REPO/hooks" --jq length)" = 0 ] && ok "0 webhooks" || bad "webhooks present"
[ "$(gh api "repos/$REPO/environments" --jq .total_count)" = 0 ] && ok "0 environments" || bad "environments present"

echo "6. PRs #1-#7 open, heads and bases as planned"
expect=("1 feature/ui-document-detail feature/ui-documents-fidelity" "2 feature/ui-knowledge-library feature/ui-document-detail" "3 feature/ui-knowledge-detail feature/ui-knowledge-library" "4 feature/ui-incident-detail feature/ui-knowledge-detail" "5 feature/ui-knowledge-create feature/ui-incident-detail" "6 feature/ui-my-courses feature/ui-knowledge-create" "7 feature/ui-approvals feature/ui-my-courses")
for e in "${expect[@]}"; do
  read -r n h b <<<"$e"
  got=$(gh pr view "$n" --json state,headRefName,baseRefName --jq '"\(.state) \(.headRefName) \(.baseRefName)"')
  [ "$got" = "OPEN $h $b" ] && ok "#$n $h -> $b" || bad "#$n: $got"
done
for n in 8 9 10 11; do [ "$(gh pr view $n --json state,baseRefName --jq '"\(.state) \(.baseRefName)"')" = "OPEN feature/ui-approvals" ] && ok "#$n open on feature/ui-approvals (not in the 9 steps)" || bad "#$n state/base changed"; done
[ "$(gh pr view 12 --json state,headRefOid,baseRefName --jq '"\(.state) \(.headRefOid[0:7]) \(.baseRefName)"')" = "OPEN 461a19a main" ] && ok "#12 (Sprint 1 → main) kept open as evidence, head 461a19a" || bad "#12 state/head changed"
[ "$(gh pr list --state all --head feature/ui-documents-fidelity --json number --jq length)" = 0 ] && ok "step-1 PR (feature/ui-documents-fidelity → main) not created yet" || bad "a PR from feature/ui-documents-fidelity already exists"
[ "$(git show origin/feature/ui-documents-fidelity:.github/workflows/ci.yml | grep -c pg16-bin)" -ge 1 ] && ok "step-1 head 30aaf53 carries the PG16 drill fix" || bad "30aaf53 lacks PG16 drill fix"

echo
[ $fail = 0 ] && echo "PREFLIGHT: PASS" || echo "PREFLIGHT: FAIL"
exit $fail
