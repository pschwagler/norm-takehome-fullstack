FROM python:3.11-slim

WORKDIR /norm-fullstack

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

COPY ./app /norm-fullstack/app
COPY ./docs /norm-fullstack/docs

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80"]
