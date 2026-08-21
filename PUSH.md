# Pushing BIG MARGIN to GitHub

The repository is already initialised with a full commit history and the remote
`https://github.com/hyr55cc/big-margin-monbile.git` configured. Only the push itself
is left.

## From your own machine

```bash
tar -xzf big-margin.tar.gz
cd big-margin

git remote -v            # origin should already point at your repo
git push -u origin main
```

If the repository already has a commit (a README created at repo creation time),
either force the first push:

```bash
git push -u origin main --force
```

or rebase onto it:

```bash
git pull --rebase origin main
git push -u origin main
```

## Then

```bash
npm install
npm run dev      # http://localhost:5173
```

## Verify the build the same way it was verified here

```bash
npm run typecheck   # tsc --noEmit
npm test            # 51 calculation tests
npm run build       # production build
npm run preview
```
