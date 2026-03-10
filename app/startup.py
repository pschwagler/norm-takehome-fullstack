import logging
import os
import shutil

from sqlmodel import Session, select

from app.database import create_db_and_tables, engine
from app.legislation_service import LegislationService
from app.models import Law, Legislation
from app.qdrant_service import QdrantService

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "data/uploads")
SEED_PDF_PATH = "docs/laws.pdf"


def startup(qdrant_service: QdrantService) -> None:
    """Initialize database, seed data if needed, and load Qdrant index."""
    # 1. Ensure directories exist
    os.makedirs("data", exist_ok=True)
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # 2. Create DB tables
    create_db_and_tables()
    logger.info("Database initialized")

    # 3. Connect Qdrant
    qdrant_service.connect()

    # 4. Seed if first run
    with Session(engine) as session:
        legislation_count = session.exec(select(Legislation)).first()
        if legislation_count is None:
            _seed_initial_legislation(session)

    # 5. Re-index all laws from DB into Qdrant
    _reindex_all(qdrant_service)


def _seed_initial_legislation(session: Session) -> None:
    """Parse and persist the seed legislation PDF."""
    if not os.path.exists(SEED_PDF_PATH):
        logger.warning("Seed PDF not found at %s", SEED_PDF_PATH)
        return

    logger.info("Seeding initial legislation from %s", SEED_PDF_PATH)

    legislation_service = LegislationService()
    parsed_laws = legislation_service.create_legislation(SEED_PDF_PATH)

    # Copy file to uploads
    dest_path = os.path.join(UPLOAD_DIR, "laws.pdf")
    shutil.copy2(SEED_PDF_PATH, dest_path)

    # Insert legislation record
    legislation = Legislation(
        name="Laws of the Seven Kingdoms",
        file_name="laws.pdf",
        file_path=dest_path,
        jurisdiction="Kingdom-wide",
    )
    session.add(legislation)
    session.commit()
    session.refresh(legislation)

    # Insert law records
    for parsed in parsed_laws:
        law = Law(
            legislation_id=legislation.id,
            section=parsed.section,
            topic=parsed.topic,
            section_title=parsed.section_title,
            text=parsed.text,
            jurisdiction=legislation.jurisdiction,
        )
        session.add(law)

    session.commit()
    logger.info(
        "Seeded legislation id=%d with %d laws",
        legislation.id,
        len(parsed_laws),
    )


def _reindex_all(qdrant_service: QdrantService) -> None:
    """Rebuild the Qdrant index from all laws in the database."""
    legislation_service = LegislationService()

    with Session(engine) as session:
        legislation_list = list(session.exec(select(Legislation)).all())
        all_leaf_nodes = []
        all_nodes = []

        for legislation in legislation_list:
            laws = list(
                session.exec(
                    select(Law).where(Law.legislation_id == legislation.id)
                ).all()
            )

            if not laws:
                continue

            # Reconstruct ParsedLaw objects from DB rows
            from app.pdf_parser import ParsedLaw

            parsed_laws = [
                ParsedLaw(
                    section=law.section,
                    topic=law.topic,
                    section_title=law.section_title,
                    text=law.text,
                )
                for law in laws
            ]

            leaf_nodes, nodes = legislation_service.create_nodes(
                parsed_laws, legislation.id, legislation.name, legislation.jurisdiction
            )
            all_leaf_nodes.extend(leaf_nodes)
            all_nodes.extend(nodes)

        if all_nodes:
            qdrant_service.load(all_leaf_nodes, all_nodes)
            logger.info(
                "Reindexed %d leaf nodes, %d total nodes",
                len(all_leaf_nodes),
                len(all_nodes),
            )
        else:
            logger.info("No laws to index")
