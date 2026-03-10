import logging
import uuid

from llama_index.core.schema import NodeRelationship, RelatedNodeInfo, TextNode

from app.pdf_parser import ParsedLaw, parse_pdf

# Namespace for deterministic UUID generation from human-readable node IDs
_NODE_UUID_NS = uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")

logger = logging.getLogger(__name__)


class LegislationService:
    """Parses legislation PDFs into structured law entries and LlamaIndex nodes."""

    def create_legislation(self, file_path: str) -> list[ParsedLaw]:
        """Parse a PDF and return structured law entries."""
        laws = parse_pdf(file_path)
        logger.info(
            "Parsed PDF",
            extra={"file_path": file_path, "law_count": len(laws)},
        )
        return laws

    def create_nodes(
        self,
        parsed_laws: list[ParsedLaw],
        legislation_id: int,
        legislation_name: str,
        jurisdiction: str,
    ) -> tuple[list[TextNode], list[TextNode]]:
        """Build leaf (law-level) and parent (topic-level) TextNodes.

        Returns (leaf_nodes, all_nodes) where all_nodes = parents + leaves.
        """
        # Group laws by topic
        topics: dict[str, list[ParsedLaw]] = {}
        for law in parsed_laws:
            topics.setdefault(law.topic, []).append(law)

        parent_nodes: list[TextNode] = []
        leaf_nodes: list[TextNode] = []

        topic_number_map = _build_topic_number_map(parsed_laws)

        for topic_name, topic_laws in topics.items():
            topic_num = topic_number_map.get(topic_name, "0")
            parent_id = str(
                uuid.uuid5(_NODE_UUID_NS, f"doc_{legislation_id}_topic_{topic_num}")
            )

            # Build parent chunk (all laws concatenated)
            parent_text = f"{topic_num}. {topic_name}\n"
            for law in topic_laws:
                parent_text += f"{law.section} {law.text}\n"

            parent_node = TextNode(
                id_=parent_id,
                text=parent_text.strip(),
                metadata={
                    "legislation_name": legislation_name,
                    "legislation_id": legislation_id,
                    "topic": topic_name,
                    "section": topic_num,
                    "jurisdiction": jurisdiction,
                    "chunk_type": "topic",
                },
                excluded_llm_metadata_keys=["chunk_type", "legislation_id"],
                excluded_embed_metadata_keys=["chunk_type", "legislation_id"],
            )

            # Build leaf chunks
            child_infos = []
            for law in topic_laws:
                leaf_id = str(
                    uuid.uuid5(_NODE_UUID_NS, f"doc_{legislation_id}_law_{law.section}")
                )

                metadata = {
                    "legislation_name": legislation_name,
                    "legislation_id": legislation_id,
                    "topic": topic_name,
                    "section": law.section,
                    "jurisdiction": jurisdiction,
                    "chunk_type": "law",
                }
                if law.section_title:
                    metadata["section_title"] = law.section_title

                leaf_node = TextNode(
                    id_=leaf_id,
                    text=law.text,
                    metadata=metadata,
                    excluded_llm_metadata_keys=["chunk_type", "legislation_id"],
                    excluded_embed_metadata_keys=["chunk_type", "legislation_id"],
                )

                # Set parent relationship
                leaf_node.relationships[NodeRelationship.PARENT] = RelatedNodeInfo(
                    node_id=parent_id
                )
                leaf_nodes.append(leaf_node)
                child_infos.append(RelatedNodeInfo(node_id=leaf_id))

            # Set children on parent
            parent_node.relationships[NodeRelationship.CHILD] = child_infos
            parent_nodes.append(parent_node)

        all_nodes = parent_nodes + leaf_nodes
        logger.info(
            "Created nodes",
            extra={
                "legislation_id": legislation_id,
                "parent_count": len(parent_nodes),
                "leaf_count": len(leaf_nodes),
            },
        )
        return leaf_nodes, all_nodes


def _build_topic_number_map(laws: list[ParsedLaw]) -> dict[str, str]:
    """Map topic names to their top-level number (e.g. 'Trials' -> '4')."""
    result: dict[str, str] = {}
    for law in laws:
        top_level = law.section.split(".")[0]
        if law.topic not in result:
            result[law.topic] = top_level
    return result
