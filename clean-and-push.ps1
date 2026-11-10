# -------------------------------------------------------------
# clean-and-push.ps1  –  Remove secret from history & push clean
# -------------------------------------------------------------

# ==== USER CONFIGURATION ==========================================
$remoteUrl = "<<REMOTE_URL>>"   # <-- replace with your repo HTTPS URL (e.g., https://github.com/your-user/Project_Trikuta.git)
$branchName = "main"            # branch you want to end up with
# ==================================================================

# 0️⃣ Change to the directory where this script lives (project root)
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

# 1️⃣ Ensure the working tree is clean (no un‑committed changes)
Write-Host "Checking for uncommitted changes..."
if (git status --porcelain) {
    Write-Error "You have uncommitted changes. Commit or stash them before running this script."
    exit 1
}
Write-Host "✅ Working tree is clean."

# 2️⃣ Make sure .env is ignored
if (-not (Select-String -Path .gitignore -Pattern '^\.env$' -Quiet)) {
    "`n.env" | Out-File -Append -Encoding utf8 .gitignore
    git add .gitignore
    Write-Host "✅ Added .env to .gitignore"
}

# 3️⃣ Remove .env from the index if it was ever tracked
if (git ls-files --error-unmatch .env 2>$null) {
    git rm --cached .env
    Write-Host "✅ Removed .env from the index"
}

# 4️⃣ Create an orphan branch (no parent commit)
git checkout --orphan __temp_clean_branch
Write-Host "✅ Created orphan branch '__temp_clean_branch'"

# 5️⃣ Stage everything (obeying .gitignore)
git add .
Write-Host "✅ Staged all files"

# 6️⃣ Commit the clean snapshot
git commit -m "Initial commit – clean history (no secrets)"
Write-Host "✅ Created clean initial commit"

# 7️⃣ Delete the old branch locally (if it exists)
git branch -D $branchName -ErrorAction SilentlyContinue

# 8️⃣ Rename the temporary branch to the desired name
git branch -m $branchName
Write-Host "✅ Renamed branch to '$branchName'"

# 9️⃣ Set (or replace) the remote named 'origin'
git remote remove origin -ErrorAction SilentlyContinue
git remote add origin $remoteUrl

# 10️⃣ Force‑push the new history
Write-Host "🚀 Pushing clean history to $remoteUrl (this overwrites the remote branch)..."
git push -u origin $branchName --force

Write-Host "`n✅ Done! The remote now contains a single clean commit."
Write-Host "   Verify on GitHub that the secret‑scan violation is gone."
Write-Host "   Future pushes will work normally."
