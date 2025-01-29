from typing import Dict, List, Optional, cast
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from fastapi import HTTPException

from ...rag.vector_index import VectorIndex
from ...schemas.rag_schemas import (

    RetrievalResultSchema,
    ChunkMetadataSchema,
)
from ...models.dc_and_vi_model import VectorIndexModel
from ...database import get_db
from ..base import (
    BaseNodeInput,
    BaseNodeOutput,
    FixedOutputBaseNode,
    FixedOutputBaseNodeConfig,
)

# Todo: Use Fixed Node Output; where the outputs will always be chunks

class RetrieverNodeConfig(FixedOutputBaseNodeConfig):
    """Configuration for the retriever node"""
    vector_index_id: str = Field("", description="ID of the vector index to query")
    top_k: int = Field(5, description="Number of results to return", ge=1, le=10)
    # score_threshold: Optional[float] = Field(None, description="Minimum similarity score threshold")
    # semantic_weight: float = Field(1.0, description="Weight for semantic search (0 to 1)")
    # keyword_weight: Optional[float] = Field(None, description="Weight for keyword search (0 to 1)")


class RetrieverNodeInput(BaseNodeInput):
    """Input for the retriever node"""
    query: str = Field(..., description="The search query")


class RetrieverNodeOutput(BaseNodeOutput):
    """Output from the retriever node"""
    results: List[RetrievalResultSchema] = Field(..., description="List of retrieved results")
    total_results: int = Field(..., description="Total number of results found")


class RetrieverNode(FixedOutputBaseNode):
    """Node for retrieving relevant documents from a vector index"""

    name = "retriever_node"
    display_name = "Retriever"
    config_model = RetrieverNodeConfig
    input_model = RetrieverNodeInput
    output_model = RetrieverNodeOutput

    @property
    def output_schema(self) -> Dict[str, str]:
        return {
            "results": f"array[{RetrievalResultSchema.__name__}]",
            "total_results": "integer"
        }

    async def validate_index(self, db: Session) -> None:
        """Validate that the vector index exists and is ready"""
        index = db.query(VectorIndexModel).filter(VectorIndexModel.id == self.config.vector_index_id).first()
        if not index:
            raise ValueError(f"Vector index {self.config.vector_index_id} not found")
        if index.status != "ready":
            raise ValueError(f"Vector index {self.config.vector_index_id} is not ready (status: {index.status})")

    async def run(self, input: BaseModel) -> BaseModel:
        input_data = cast(RetrieverNodeInput, input)
        # Get database session
        db = next(get_db())

        try:
            # Validate index exists and is ready
            await self.validate_index(db)

            # Initialize vector index
            vector_index = VectorIndex(self.config.vector_index_id)

            # Create retrieval request
            results = await vector_index.retrieve(
                query=input_data.query,
                top_k=self.config.top_k,
                score_threshold=self.config.score_threshold,
                semantic_weight=self.config.semantic_weight,
                keyword_weight=self.config.keyword_weight,
            )

            # Format results
            formatted_results: List[RetrievalResultSchema] = []
            for result in results:
                chunk = result["chunk"]
                metadata = result["metadata"]
                formatted_results.append(
                    RetrievalResultSchema(
                        text=chunk.text,
                        score=result["score"],
                        metadata=ChunkMetadataSchema(
                            document_id=metadata.get("document_id", ""),
                            chunk_id=metadata.get("chunk_id", ""),
                            document_title=metadata.get("document_title"),
                            page_number=metadata.get("page_number"),
                            chunk_number=metadata.get("chunk_number"),
                        )
                    )
                )

            return RetrieverNodeOutput(
                results=formatted_results,
                total_results=len(formatted_results)
            )
        except Exception as e:
            raise ValueError(f"Error retrieving from vector index: {str(e)}")
        finally:
            db.close()


if __name__ == "__main__":
    import asyncio

    async def test_retriever_node():
        # Create a test instance
        retriever = RetrieverNode(
            name="test_retriever",
            config=RetrieverNodeConfig(
                vector_index_id="VI1",  # Using proper vector index ID format
                top_k=3,
                score_threshold=0.7,

            ),
        )

        # Create test input
        test_input = RetrieverNodeInput(
            query="What is machine learning?"
        )

        print("[DEBUG] Testing retriever_node...")
        try:
            output = await retriever(test_input)
            print("[DEBUG] Test Output:", output)
        except Exception as e:
            print("[ERROR] Test failed:", str(e))

    asyncio.run(test_retriever_node())
