"""Tests for app/startup.py -- startup(), _seed_initial_legislation(), _reindex_all()."""
import os
from unittest.mock import MagicMock, call, patch

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.models import Law, Legislation
from app.pdf_parser import ParsedLaw
from app.startup import _reindex_all, _seed_initial_legislation, startup


# ---------------------------------------------------------------------------
# In-memory DB fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mem_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def mem_session(mem_engine):
    with Session(mem_engine) as session:
        yield session


# ---------------------------------------------------------------------------
# startup()
# ---------------------------------------------------------------------------


def test_startup_creates_directories(tmp_path, mem_engine):
    upload_dir = str(tmp_path / "uploads")
    mock_qdrant = MagicMock()

    with (
        patch("app.startup.create_db_and_tables"),
        patch("app.startup.engine", mem_engine),
        patch("app.startup.UPLOAD_DIR", upload_dir),
        patch("app.startup._seed_initial_legislation"),
        patch("app.startup._reindex_all"),
        patch("os.makedirs") as mock_makedirs,
    ):
        startup(mock_qdrant)

    data_call = call("data", exist_ok=True)
    upload_call = call(upload_dir, exist_ok=True)
    mock_makedirs.assert_any_call("data", exist_ok=True)
    mock_makedirs.assert_any_call(upload_dir, exist_ok=True)


def test_startup_calls_create_db_and_tables(mem_engine):
    mock_qdrant = MagicMock()

    with (
        patch("app.startup.create_db_and_tables") as mock_create_db,
        patch("app.startup.engine", mem_engine),
        patch("app.startup._seed_initial_legislation"),
        patch("app.startup._reindex_all"),
        patch("os.makedirs"),
    ):
        startup(mock_qdrant)

    mock_create_db.assert_called_once()


def test_startup_calls_connect(mem_engine):
    mock_qdrant = MagicMock()

    with (
        patch("app.startup.create_db_and_tables"),
        patch("app.startup.engine", mem_engine),
        patch("app.startup._seed_initial_legislation"),
        patch("app.startup._reindex_all"),
        patch("os.makedirs"),
    ):
        startup(mock_qdrant)

    mock_qdrant.connect.assert_called_once()


def test_startup_seeds_when_no_legislation(mem_engine):
    """_seed_initial_legislation called when DB has no Legislation rows."""
    mock_qdrant = MagicMock()

    with (
        patch("app.startup.create_db_and_tables"),
        patch("app.startup.engine", mem_engine),
        patch("app.startup._seed_initial_legislation") as mock_seed,
        patch("app.startup._reindex_all"),
        patch("os.makedirs"),
    ):
        startup(mock_qdrant)

    mock_seed.assert_called_once()


def test_startup_skips_seed_when_legislation_exists(mem_engine):
    """_seed_initial_legislation NOT called when at least one Legislation row exists."""
    with Session(mem_engine) as session:
        leg = Legislation(
            name="Existing Laws",
            file_name="existing.pdf",
            file_path="data/uploads/existing.pdf",
            jurisdiction="Kingdom-wide",
        )
        session.add(leg)
        session.commit()

    mock_qdrant = MagicMock()

    with (
        patch("app.startup.create_db_and_tables"),
        patch("app.startup.engine", mem_engine),
        patch("app.startup._seed_initial_legislation") as mock_seed,
        patch("app.startup._reindex_all"),
        patch("os.makedirs"),
    ):
        startup(mock_qdrant)

    mock_seed.assert_not_called()


def test_startup_calls_reindex_all(mem_engine):
    mock_qdrant = MagicMock()

    with (
        patch("app.startup.create_db_and_tables"),
        patch("app.startup.engine", mem_engine),
        patch("app.startup._seed_initial_legislation"),
        patch("app.startup._reindex_all") as mock_reindex,
        patch("os.makedirs"),
    ):
        startup(mock_qdrant)

    mock_reindex.assert_called_once_with(mock_qdrant)


# ---------------------------------------------------------------------------
# _seed_initial_legislation()
# ---------------------------------------------------------------------------


def test_seed_skips_when_pdf_not_found(mem_session):
    with patch("app.startup.os.path.exists", return_value=False):
        _seed_initial_legislation(mem_session)

    legislation_count = list(mem_session.exec(select(Legislation)).all())
    assert len(legislation_count) == 0


def test_seed_inserts_legislation_record(tmp_path, mem_session):
    mock_laws = [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="All lords shall keep peace."),
        ParsedLaw(section="1.2", topic="Peace", section_title=None, text="Violations are punished."),
    ]

    with (
        patch("app.startup.os.path.exists", return_value=True),
        patch("app.startup.LegislationService") as mock_svc_cls,
        patch("app.startup.shutil.copy2"),
        patch("app.startup.UPLOAD_DIR", str(tmp_path)),
        patch("app.startup.engine"),
    ):
        mock_svc = MagicMock()
        mock_svc.create_legislation.return_value = mock_laws
        mock_svc_cls.return_value = mock_svc

        _seed_initial_legislation(mem_session)

    legislations = list(mem_session.exec(select(Legislation)).all())
    assert len(legislations) == 1
    assert legislations[0].name == "Laws of the Seven Kingdoms"
    assert legislations[0].file_name == "laws.pdf"
    assert legislations[0].jurisdiction == "Kingdom-wide"


def test_seed_inserts_law_records(tmp_path, mem_session):
    mock_laws = [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="All lords shall keep peace."),
        ParsedLaw(section="4.2.1", topic="Trials", section_title="Trials by combat", text="Any knight accused..."),
    ]

    with (
        patch("app.startup.os.path.exists", return_value=True),
        patch("app.startup.LegislationService") as mock_svc_cls,
        patch("app.startup.shutil.copy2"),
        patch("app.startup.UPLOAD_DIR", str(tmp_path)),
        patch("app.startup.engine"),
    ):
        mock_svc = MagicMock()
        mock_svc.create_legislation.return_value = mock_laws
        mock_svc_cls.return_value = mock_svc

        _seed_initial_legislation(mem_session)

    laws = list(mem_session.exec(select(Law)).all())
    assert len(laws) == 2
    sections = {law.section for law in laws}
    assert "1.1" in sections
    assert "4.2.1" in sections


def test_seed_copies_pdf_to_upload_dir(tmp_path, mem_session):
    mock_laws = [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="text"),
    ]

    with (
        patch("app.startup.os.path.exists", return_value=True),
        patch("app.startup.LegislationService") as mock_svc_cls,
        patch("app.startup.shutil.copy2") as mock_copy,
        patch("app.startup.UPLOAD_DIR", str(tmp_path)),
        patch("app.startup.engine"),
    ):
        mock_svc = MagicMock()
        mock_svc.create_legislation.return_value = mock_laws
        mock_svc_cls.return_value = mock_svc

        _seed_initial_legislation(mem_session)

    dest = os.path.join(str(tmp_path), "laws.pdf")
    mock_copy.assert_called_once_with("docs/laws.pdf", dest)


def test_seed_law_jurisdiction_matches_legislation(tmp_path, mem_session):
    mock_laws = [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="text"),
    ]

    with (
        patch("app.startup.os.path.exists", return_value=True),
        patch("app.startup.LegislationService") as mock_svc_cls,
        patch("app.startup.shutil.copy2"),
        patch("app.startup.UPLOAD_DIR", str(tmp_path)),
        patch("app.startup.engine"),
    ):
        mock_svc = MagicMock()
        mock_svc.create_legislation.return_value = mock_laws
        mock_svc_cls.return_value = mock_svc

        _seed_initial_legislation(mem_session)

    laws = list(mem_session.exec(select(Law)).all())
    assert all(law.jurisdiction == "Kingdom-wide" for law in laws)


def test_seed_law_section_title_optional(tmp_path, mem_session):
    mock_laws = [
        ParsedLaw(section="1.1", topic="Peace", section_title=None, text="text A"),
        ParsedLaw(section="4.2.1", topic="Trials", section_title="Trials by combat", text="text B"),
    ]

    with (
        patch("app.startup.os.path.exists", return_value=True),
        patch("app.startup.LegislationService") as mock_svc_cls,
        patch("app.startup.shutil.copy2"),
        patch("app.startup.UPLOAD_DIR", str(tmp_path)),
        patch("app.startup.engine"),
    ):
        mock_svc = MagicMock()
        mock_svc.create_legislation.return_value = mock_laws
        mock_svc_cls.return_value = mock_svc

        _seed_initial_legislation(mem_session)

    laws = list(mem_session.exec(select(Law)).all())
    law_map = {law.section: law for law in laws}
    assert law_map["1.1"].section_title is None
    assert law_map["4.2.1"].section_title == "Trials by combat"


# ---------------------------------------------------------------------------
# _reindex_all()
# ---------------------------------------------------------------------------


def test_reindex_all_loads_nothing_when_no_legislation(mem_engine):
    mock_qdrant = MagicMock()

    with patch("app.startup.engine", mem_engine):
        _reindex_all(mock_qdrant)

    mock_qdrant.load.assert_not_called()


def test_reindex_all_skips_legislation_with_no_laws(mem_engine):
    with Session(mem_engine) as session:
        leg = Legislation(
            name="Empty Laws",
            file_name="empty.pdf",
            file_path="data/uploads/empty.pdf",
            jurisdiction="Kingdom-wide",
        )
        session.add(leg)
        session.commit()

    mock_qdrant = MagicMock()

    with patch("app.startup.engine", mem_engine):
        _reindex_all(mock_qdrant)

    mock_qdrant.load.assert_not_called()


def test_reindex_all_calls_load_with_nodes(mem_engine):
    with Session(mem_engine) as session:
        leg = Legislation(
            name="Laws",
            file_name="laws.pdf",
            file_path="data/uploads/laws.pdf",
            jurisdiction="Kingdom-wide",
        )
        session.add(leg)
        session.commit()
        session.refresh(leg)

        law = Law(
            legislation_id=leg.id,
            section="1.1",
            topic="Peace",
            text="All lords shall keep peace.",
            jurisdiction="Kingdom-wide",
        )
        session.add(law)
        session.commit()

    mock_qdrant = MagicMock()
    mock_leaf = [MagicMock()]
    mock_all = [MagicMock(), MagicMock()]

    with (
        patch("app.startup.engine", mem_engine),
        patch("app.startup.LegislationService") as mock_svc_cls,
    ):
        mock_svc = MagicMock()
        mock_svc.create_nodes.return_value = (mock_leaf, mock_all)
        mock_svc_cls.return_value = mock_svc

        _reindex_all(mock_qdrant)

    mock_qdrant.load.assert_called_once_with(mock_leaf, mock_all)


def test_reindex_all_aggregates_multiple_legislation(mem_engine):
    with Session(mem_engine) as session:
        for i in range(2):
            leg = Legislation(
                name=f"Laws {i}",
                file_name=f"laws_{i}.pdf",
                file_path=f"data/uploads/laws_{i}.pdf",
                jurisdiction="Kingdom-wide",
            )
            session.add(leg)
            session.commit()
            session.refresh(leg)

            law = Law(
                legislation_id=leg.id,
                section=f"{i + 1}.1",
                topic="Peace",
                text="Some law text.",
                jurisdiction="Kingdom-wide",
            )
            session.add(law)
        session.commit()

    mock_qdrant = MagicMock()
    leaf_a = [MagicMock()]
    all_a = [MagicMock(), MagicMock()]
    leaf_b = [MagicMock()]
    all_b = [MagicMock(), MagicMock()]

    with (
        patch("app.startup.engine", mem_engine),
        patch("app.startup.LegislationService") as mock_svc_cls,
    ):
        mock_svc = MagicMock()
        mock_svc.create_nodes.side_effect = [
            (leaf_a, all_a),
            (leaf_b, all_b),
        ]
        mock_svc_cls.return_value = mock_svc

        _reindex_all(mock_qdrant)

    mock_qdrant.load.assert_called_once()
    loaded_leaves, loaded_all = mock_qdrant.load.call_args[0]
    assert loaded_leaves == leaf_a + leaf_b
    assert loaded_all == all_a + all_b


def test_reindex_all_reconstructs_parsed_laws_from_db(mem_engine):
    """Verify ParsedLaw objects passed to create_nodes match DB records."""
    with Session(mem_engine) as session:
        leg = Legislation(
            name="Laws",
            file_name="laws.pdf",
            file_path="data/uploads/laws.pdf",
            jurisdiction="Kingdom-wide",
        )
        session.add(leg)
        session.commit()
        session.refresh(leg)

        law = Law(
            legislation_id=leg.id,
            section="1.1",
            topic="Peace",
            section_title=None,
            text="All lords shall keep peace.",
            jurisdiction="Kingdom-wide",
        )
        session.add(law)
        session.commit()

    mock_qdrant = MagicMock()
    captured_args = {}

    def capture_create_nodes(parsed_laws, legislation_id, legislation_name, jurisdiction):
        captured_args["parsed_laws"] = parsed_laws
        captured_args["legislation_id"] = legislation_id
        return ([MagicMock()], [MagicMock(), MagicMock()])

    with (
        patch("app.startup.engine", mem_engine),
        patch("app.startup.LegislationService") as mock_svc_cls,
    ):
        mock_svc = MagicMock()
        mock_svc.create_nodes.side_effect = capture_create_nodes
        mock_svc_cls.return_value = mock_svc

        _reindex_all(mock_qdrant)

    assert len(captured_args["parsed_laws"]) == 1
    pl = captured_args["parsed_laws"][0]
    assert pl.section == "1.1"
    assert pl.topic == "Peace"
    assert pl.text == "All lords shall keep peace."
    assert pl.section_title is None
