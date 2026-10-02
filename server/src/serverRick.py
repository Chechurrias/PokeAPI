import os
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pymongo.errors import PyMongoError

MONGODB_URI = os.getenv("MONGODB_URI")
if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI no está configurado.")

DATABASE_NAME = os.getenv("MONGODB_DATABASE", "rickandmorty")
COLLECTION_NAME = os.getenv("MONGODB_COLLECTION", "characters")
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
collection = client[DATABASE_NAME][COLLECTION_NAME]

app = FastAPI(
    title="Rick and Morty API",
    description="Consulta personajes almacenados en MongoDB Atlas.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://(?:localhost|127\.0\.0\.1)(?::\d+)?$",
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"]
)

CHARACTER_FIELDS = (
    "id",
    "name",
    "status",
    "species",
    "type",
    "gender",
    "origin",
    "location",
    "image",
    "episode",
    "url",
    "created",
)
CHARACTER_PROJECTION = dict.fromkeys(CHARACTER_FIELDS, 1)
CHARACTER_PROJECTION["_id"] = 0


def serialize_character(character):
    return {field: character.get(field) for field in CHARACTER_FIELDS}


@app.get("/health", responses={503: {"description": "MongoDB Atlas no disponible"}})
def health_check():
    try:
        client.admin.command("ping")
    except PyMongoError as error:
        raise HTTPException(status_code=503, detail="No se pudo conectar con MongoDB Atlas.") from error

    return {"ok": True, "service": "rickandmorty-api", "db": True}


@app.get(
    "/api/character/{identifier}",
    responses={
        400: {"description": "Identificador inválido"},
        404: {"description": "Personaje no encontrado"},
        503: {"description": "MongoDB Atlas no disponible"},
    },
)
def get_character(identifier: str):
    identifier_clean = identifier.strip()
    if not identifier_clean:
        raise HTTPException(status_code=400, detail="Escribe el nombre o ID del personaje.")

    if identifier_clean.isdigit():
        query = {"id": int(identifier_clean)}
    else:
        if not re.fullmatch(r"[a-zA-Z0-9\s-]+", identifier_clean):
            raise HTTPException(status_code=400, detail="El nombre del personaje no es válido.")
        query = {"name": {"$regex": f"^{re.escape(identifier_clean)}$", "$options": "i"}}

    try:
        character = collection.find_one(query, CHARACTER_PROJECTION)
    except PyMongoError as error:
        raise HTTPException(status_code=503, detail="No se pudo consultar MongoDB Atlas.") from error

    if not character:
        raise HTTPException(status_code=404, detail="Personaje no encontrado en la base de datos.")

    return serialize_character(character)


@app.get("/api/characters", responses={503: {"description": "MongoDB Atlas no disponible"}})
def get_all_characters():
    try:
        characters = collection.find({}, CHARACTER_PROJECTION).sort("id", 1)
        return [serialize_character(character) for character in characters]
    except PyMongoError as error:
        raise HTTPException(status_code=503, detail="No se pudo consultar MongoDB Atlas.") from error