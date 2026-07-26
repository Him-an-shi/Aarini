<div align="center">

<br/>

# 🌸 Contributing to Aarini

### _Thank you for helping us build a better women's health companion!_

> Every line of code you write helps a woman understand her body a little better. We're so glad you're here. 💜

<br/>

---

</div>

## 📖 Table of Contents

- [🙋 How to Get Assigned to an Issue](#-how-to-get-assigned-to-an-issue)
- [🏅 Difficulty Labels & XP Points](#-difficulty-labels--xp-points)
- [🌿 Branch Naming Convention](#-branch-naming-convention)
- [⚙️ Local Setup](#️-local-setup)
- [📝 PR Title Format](#-pr-title-format)
- [📋 PR Description Requirements](#-pr-description-requirements)
- [✅ PR Checklist](#-pr-checklist)
- [🚫 What Not to Do](#-what-not-to-do)
- [💜 Code of Conduct](#-code-of-conduct)

---

## 🙋 How to Get Assigned to an Issue

We use GitHub Issues to manage all tasks. **Please do not start work without being assigned** — this prevents duplicate effort and keeps things fair for everyone.

1. **Browse open issues** at [github.com/Him-an-shi/Aarini/issues](https://github.com/Him-an-shi/Aarini/issues)
2. **Find an issue** that matches your skills and interest
3. **Comment on the issue** — something like:
   > _"Hi! I'd love to work on this. I'm familiar with React Native / Flask / docs (pick yours). Can I be assigned? 😊"_
4. **Wait for a maintainer to assign you** before you start coding
5. Once assigned, you own that issue — aim to submit your PR within **7 days** so the issue stays active

> 💡 **Tip:** If you're new here, look for issues labeled `NEWBIE` — they're designed to be welcoming first contributions!

---

## 🏅 Difficulty Labels & XP Points

Aarini uses the **ELUSoC'26** contribution program. Each issue is tagged with a difficulty label that carries XP points:

| Label             | Difficulty   | XP Points | What to Expect                                                                     |
| ----------------- | ------------ | :-------: | ---------------------------------------------------------------------------------- |
| 🟢 **NEWBIE**     | Beginner     | **10 XP** | Documentation, small bug fixes, config files, minor UI tweaks                      |
| 🔵 **ADVENTURER** | Intermediate | **25 XP** | New features, API routes, screen components, service integrations                  |
| 🔴 **VETERAN**    | Advanced     | **50 XP** | Architecture changes, AI integration, performance optimizations, complex refactors |

XP points are tracked on the ELUSoC leaderboard. Every contribution counts — no matter the size! 🌟

---

## 🌿 Branch Naming Convention

Always create a new branch from `main` for your work. Use the following naming patterns:

| Type             | Pattern                     | Example                        |
| ---------------- | --------------------------- | ------------------------------ |
| ✨ New Feature   | `feature/your-feature-name` | `feature/ovulation-prediction` |
| 🐛 Bug Fix       | `fix/bug-name`              | `fix/cycle-date-validation`    |
| 📚 Documentation | `docs/topic-name`           | `docs/contributing-guide`      |
| 💅 Styling / UI  | `style/component-name`      | `style/dashboard-dark-mode`    |
| ♻️ Refactor      | `refactor/what-changed`     | `refactor/firebase-queries`    |
| ✅ Tests         | `test/what-is-tested`       | `test/cycle-tracker-unit`      |

```bash
# Always branch off from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

> ⚠️ **Do not push directly to `main`.** All changes must go through a Pull Request.

---

## ⚙️ Local Setup

> For a full setup guide, refer to the [README.md → Installation Guide](README.md#️-installation-guide). Here's a quick summary:

### 📱 Frontend (React Native + Expo)

```bash
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# → Set EXPO_PUBLIC_API_URL to your backend URL

# Start the Expo dev server
npx expo start
```

> Scan the QR code with **Expo Go** on your phone, or press `a` for Android / `i` for iOS emulator.

### ⚙️ Backend (Flask + Python)

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env
# → Fill in your GEMINI_API_KEY, Firebase credentials, etc.

# Run the Flask dev server
flask run
```

> The backend starts at `http://localhost:5000`. Make sure your frontend `.env` points to this URL.

---

## 📝 PR Title Format

All Pull Requests **must** follow this title format:

```
[ELUSoC'26] brief description of change
```

**Examples:**

```
[ELUSoC'26] Add .env.example for frontend directory
[ELUSoC'26] Fix hardcoded API URL fallback in AuthContext
[ELUSoC'26] Add CONTRIBUTING.md with ELUSoC guidelines
[ELUSoC'26] Implement ovulation prediction endpoint
```

> 📌 Including `[ELUSoC'26]` in your title is **required** for your contribution to be counted on the leaderboard.

---

## 📋 PR Description Requirements

When opening a Pull Request, please fill out the following in your description:

### 🔗 Linked Issue

```
Closes #<issue-number>
```

Every PR **must** be linked to an issue. No issue → No PR.

### 📝 Summary

A short description of _what_ you changed and _why_.

> Example: _"Created `frontend/.env.example` so new contributors have a clear template for the required environment variables. Updated `services/api.js` to use `process.env.EXPO_PUBLIC_API_URL` with a `localhost:5000` fallback."_

### 📸 Screenshots (if UI changed)

If your change affects any screen or visual component, include before/after screenshots. This helps reviewers quickly validate the change.

### 🧪 Testing Performed

Describe what you tested:

- Did the app build without errors?
- Did you test on a real device or emulator?
- Which flows did you manually verify?

> Example: _"Tested on Android emulator (Pixel 7). App builds and runs. Login, cycle tracking, and AI chat all functional."_

---

## ✅ PR Checklist

Before submitting your PR, make sure all of the following are true:

- [ ] I am **assigned to the linked issue** before opening this PR
- [ ] My branch name follows the **naming convention** (`feature/`, `fix/`, `docs/`, etc.)
- [ ] The app **builds and runs** without errors (`npx expo start` / `flask run`)
- [ ] I have **not committed** a `.env` file
- [ ] I have **not committed** a Firebase service account JSON file
- [ ] My changes are **scoped to the issue** — no unrelated modifications bundled in
- [ ] My PR title starts with `[ELUSoC'26]`
- [ ] I have **linked the issue** in the PR description (`Closes #XX`)
- [ ] I have included **screenshots** if my change affects the UI

---

## 🚫 What Not to Do

Please avoid the following — they are the most common reasons PRs get closed without merging:

| ❌ Don't                                                | ✅ Do Instead                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| Open a PR without being assigned                        | Comment on the issue first and wait for assignment                     |
| Bundle multiple unrelated fixes in one PR               | One issue → One PR                                                     |
| Push directly to `main`                                 | Always work on a feature/fix/docs branch                               |
| Commit `.env` or service account JSON files             | Keep secrets out of version control — use `.env.example` as a template |
| Copy-paste code from other repositories without credit  | Write original code; if referencing something, attribute it            |
| Use a generic branch name like `patch-1` or `my-branch` | Follow the naming convention: `feature/your-feature-name`              |
| Skip the PR description                                 | Fill out all required fields — linked issue, summary, testing          |

> 💬 If you're unsure about anything, ask in the issue comments before starting. We're always happy to help! 🌸

---

## 💜 Code of Conduct

Aarini is built on **empathy, respect, and inclusivity** — the same values we embed into the product itself.

As a contributor, you agree to:

- 🤝 **Be kind and respectful** — to maintainers, to other contributors, and to users
- 🌸 **Be empathetic** — remember we're building tools for women's health; bring that sensitivity to your work
- 🔒 **Respect privacy** — never share or mishandle any health-related data you encounter while contributing
- 📖 **Be transparent** — if you're blocked, say so. If you can't finish an issue, let us know so it can be reassigned
- 🌍 **Be inclusive** — we welcome contributors of all backgrounds, experience levels, and identities

Harassment, discrimination, or disrespectful behavior of any kind will result in immediate removal from the project.

> _"When women thrive, the world thrives."_ — Let's build something worthy of that.

---

<div align="center">

Built with 💜 by [Himanshi](https://github.com/Him-an-shi) and the Aarini Community

_Questions? Open a [GitHub Discussion](https://github.com/Him-an-shi/Aarini/discussions) or drop a comment on the relevant issue._

<br/>

⭐ **If Aarini resonates with you, please give it a star — it helps more women discover it!** ⭐

</div>
