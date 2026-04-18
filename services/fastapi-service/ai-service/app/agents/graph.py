from langgraph.graph import StateGraph, END
from app.agents.state import PostGenState
from app.agents.nodes import validators, vision, pricing, post_gen


def _route(next_node: str):
    """Return a router fn that goes to next_node on success, END on error."""
    def router(state: PostGenState) -> str:
        return END if state.get("error") else next_node
    return router


def build_graph():
    graph = StateGraph(PostGenState)

    graph.add_node("validate_input", validators.validate_input)
    graph.add_node("vision_extractor", vision.vision_extractor)
    graph.add_node("base_price", pricing.base_price)
    graph.add_node("seasonal", pricing.seasonal)
    graph.add_node("similar", pricing.similar)
    graph.add_node("price_calculator", pricing.price_calculator)
    graph.add_node("post_generator", post_gen.post_generator)
    graph.add_node("post_validator", validators.post_validator)
    graph.add_node("save_draft", post_gen.save_draft)

    graph.set_entry_point("validate_input")

    # Nodes that can error → conditional edges
    graph.add_conditional_edges(
        "validate_input",
        _route("vision_extractor"),
        {END: END, "vision_extractor": "vision_extractor"},
    )
    graph.add_conditional_edges(
        "vision_extractor",
        _route("base_price"),
        {END: END, "base_price": "base_price"},
    )

    # Pure computation nodes — always succeed
    graph.add_edge("base_price", "seasonal")
    graph.add_edge("seasonal", "similar")
    graph.add_edge("similar", "price_calculator")
    graph.add_edge("price_calculator", "post_generator")

    graph.add_conditional_edges(
        "post_generator",
        _route("post_validator"),
        {END: END, "post_validator": "post_validator"},
    )
    graph.add_conditional_edges(
        "post_validator",
        _route("save_draft"),
        {END: END, "save_draft": "save_draft"},
    )
    graph.add_conditional_edges(
        "save_draft",
        _route(END),
        {END: END},
    )

    return graph.compile()
