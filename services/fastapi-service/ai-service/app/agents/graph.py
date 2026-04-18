from langgraph.graph import StateGraph, END
from app.agents.state import PostGenState
from app.agents.nodes import validators, vision, pricing, post_gen


def build_graph():
    """Build the LangGraph pipeline"""
    graph = StateGraph(PostGenState)

    # Add nodes
    graph.add_node("validate_input", validators.validate_input)
    graph.add_node("vision_extractor", vision.vision_extractor)
    graph.add_node("base_price", pricing.base_price)
    graph.add_node("seasonal", pricing.seasonal)
    graph.add_node("similar", pricing.similar)
    graph.add_node("price_calculator", pricing.price_calculator)
    graph.add_node("post_generator", post_gen.post_generator)
    graph.add_node("post_validator", validators.post_validator)
    graph.add_node("save_draft", post_gen.save_draft)

    # Define flow
    graph.set_entry_point("validate_input")

    # Main flow
    graph.add_edge("validate_input", "vision_extractor")
    graph.add_edge("vision_extractor", "base_price")
    graph.add_edge("base_price", "seasonal")
    graph.add_edge("seasonal", "similar")
    graph.add_edge("similar", "price_calculator")
    graph.add_edge("price_calculator", "post_generator")
    graph.add_edge("post_generator", "post_validator")
    graph.add_edge("post_validator", "save_draft")
    graph.add_edge("save_draft", END)

    # Error handling - if any node returns error, go to END
    def error_router(state: PostGenState):
        return END if state.get("error") else "continue"

    # Add conditional edges for error handling
    graph.add_conditional_edges("validate_input", error_router, {"__end__": END})
    graph.add_conditional_edges("vision_extractor", error_router, {"__end__": END})
    graph.add_conditional_edges("post_validator", error_router, {"__end__": END})
    graph.add_conditional_edges("save_draft", error_router, {"__end__": END})

    return graph.compile()