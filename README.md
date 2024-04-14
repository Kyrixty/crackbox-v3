# Crackbox V3
<p align="center">
  <img src="https://github.com/Kyrixty/crackbox-v3/blob/main/src/web/public/imgs/crackbox-logo-name.png?raw=true" />
</p>

<p style="text-align: center;">
  This is the third (and hopefully last) iteration of Crackbox, a custom-made party game inspired by the Jackbox Party Pack series.
</p>

## Setup

### API
Before doing anything, if you see an `@DEBUG` in this it means that an option/feature/whatever is only active if `DEBUG` is set to `True` in `src/api/globals.py`.
To setup the API, do the following (python=3.10):

First, `cd` into the correct directory:
```bash
cd src/api
```

#### First time setup
If this is your first time setting up and running the backend instance, you should run the following scripts first:

```bash
pip install -r requirements.txt
python setup.py
```
This will create a `config.json` under the current directory. You can turn on `simulate_lag@DEBUG` if in development.

Note: the `DEBUG` flag in `src/api/globals.py` should be set to `False` in production. Please make sure you set it to `False`
before deploying (or create a production pipeline to automatically do this).

#### Running the API
```bash
uvicorn main:app
```

Production deployments may look different and you will want to consult their docs to see what the proper setup is for them.
A basic Nginx + Gunicorn setup *seems* to be fine, though.

### Web
First, `cd` into the correct directory:
```bash
cd src/web
```

#### First time setup
Install dependencies:
```bash
yarn
```

#### Running the frontend
Pretty simple in development, just use:
```bash
npx vite
```
Note that you will need to build the frontend for production. Lookup a tutorial if needed.
