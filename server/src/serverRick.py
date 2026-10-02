import os
import re

from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import PyMongoError


class CharacterPlace(BaseModel):
    name: str = Field(description="Nombre del origen o ubicación")
    url: str = Field(description="URL del recurso relacionado")


class CharacterResponse(BaseModel):
    id: int = Field(description="Identificador del personaje")
    name: str = Field(description="Nombre del personaje")
    status: str = Field(description="Estado vital del personaje")
    species: str = Field(description="Especie")
    type: str = Field(description="Tipo o subespecie; vacío si no aplica")
    gender: str = Field(description="Género")
    origin: CharacterPlace = Field(description="Origen del personaje")
    location: CharacterPlace = Field(description="Última ubicación conocida")
    image: str = Field(description="URL de la imagen")
    episode: list[str] = Field(description="Episodios en los que aparece")
    url: str | None = Field(default=None, description="URL del recurso del personaje")
    created: str | None = Field(default=None, description="Fecha de creación del registro")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "id": 1,
                    "name": "Rick Sanchez",
                    "status": "Alive",
                    "species": "Human",
                    "type": "",
                    "gender": "Male",
                    "origin": {"name": "Earth (C-137)", "url": ""},
                    "location": {"name": "Earth (Replacement Dimension)", "url": ""},
                    "image": "https://example.com/rick.png",
                    "episode": ["https://example.com/episode/1"],
                    "url": "https://example.com/character/1",
                    "created": "2017-11-04T18:48:46.250Z",
                }
            ]
        }
    }


class HealthResponse(BaseModel):
    ok: bool = Field(description="Indica si el servicio está disponible")
    service: str = Field(description="Nombre del microservicio")
    db: bool = Field(description="Resultado de la conexión a MongoDB Atlas")


class ErrorResponse(BaseModel):
    detail: str = Field(description="Descripción del error")


class RootResponse(BaseModel):
    message: str = Field(description="Estado del microservicio")
    docs: str = Field(description="Ruta relativa de Swagger UI")
    characters: str = Field(description="Ruta relativa para listar personajes")


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
    openapi_tags=[
        {"name": "Sistema", "description": "Estado y metadatos del microservicio."},
        {"name": "Personajes", "description": "Consultas a los personajes guardados en MongoDB Atlas."},
    ],
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get(
    "/health",
    response_model=HealthResponse,
    summary="Verificar el servicio y MongoDB Atlas",
    description="Ejecuta un ping a MongoDB Atlas y devuelve el estado de la conexión.",
    tags=["Sistema"],
    responses={
        503: {
            "model": ErrorResponse,
            "description": "No se pudo conectar con MongoDB Atlas",
            "content": {"application/json": {"example": {"detail": "No se pudo conectar con MongoDB Atlas."}}},
        }
    },
)
def health_check():
    try:
        client.admin.command("ping")
    except PyMongoError as error:
        raise HTTPException(status_code=503, detail="No se pudo conectar con MongoDB Atlas.") from error

    return {"ok": True, "service": "rickandmorty-api", "db": True}


@app.get(
    "/api/character/{identifier}",
    response_model=CharacterResponse,
    summary="Consultar un personaje",
    description="Busca por ID numérico o por nombre completo, sin distinguir mayúsculas y minúsculas.",
    tags=["Personajes"],
    responses={
        400: {
            "model": ErrorResponse,
            "description": "El nombre contiene caracteres no admitidos",
            "content": {"application/json": {"example": {"detail": "El nombre del personaje no es válido."}}},
        },
        404: {
            "model": ErrorResponse,
            "description": "No existe un personaje con ese ID o nombre",
            "content": {"application/json": {"example": {"detail": "Personaje no encontrado en la base de datos."}}},
        },
        503: {
            "model": ErrorResponse,
            "description": "MongoDB Atlas no disponible",
            "content": {"application/json": {"example": {"detail": "No se pudo consultar MongoDB Atlas."}}},
        },
    },
)
def get_character(identifier: str = Path(description="ID numérico o nombre completo del personaje", examples=["1", "Rick Sanchez"])):
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


@app.get(
    "/api/characters",
    response_model=list[CharacterResponse],
    summary="Listar personajes",
    description="Devuelve todos los personajes de la colección, ordenados por ID ascendente.",
    tags=["Personajes"],
    responses={
        503: {
            "model": ErrorResponse,
            "description": "MongoDB Atlas no disponible",
            "content": {"application/json": {"example": {"detail": "No se pudo consultar MongoDB Atlas."}}},
        }
    },
)
def get_all_characters():
    try:
        characters = collection.find({}, CHARACTER_PROJECTION).sort("id", 1)
        return [serialize_character(character) for character in characters]
    except PyMongoError as error:
        raise HTTPException(status_code=503, detail="No se pudo consultar MongoDB Atlas.") from error


@app.get(
    "/",
    response_model=RootResponse,
    summary="Información del microservicio",
    description="Devuelve las rutas principales disponibles.",
    tags=["Sistema"],
)
def root():
    return {
        "message": "Rick and Morty API Microservice running on Render",
        "docs": "/docs",
        "characters": "/api/characters"
    }