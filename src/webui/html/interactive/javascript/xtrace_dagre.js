
function drawXTraceGraph(attachPoint, reports) {

// Create the graph representation
var graph = createGraphFromReports(reports);

// Twiddle the attach point a little bit
var rootSVG = d3.select(attachPoint).append("svg");
var graphSVG = rootSVG.append("svg").attr("width", "100%").attr("height", "100%").attr("class", "graph-attach");
var minimapSVG = rootSVG.append("svg").attr("class", "minimap-attach");
var listSVG = rootSVG.append("svg").attr("class", "history-attach");

// Create the chart instances
var DAG = DirectedAcyclicGraph();
var DAGMinimap = DirectedAcyclicGraphMinimap(DAG).width("19.5%").height("19.5%").x("80%").y("80%");
var DAGHistory = List().width("8%").height("99%").x("0.5%").y("0.5%");

// Create the history representation
var history = DirectedAcyclicGraphHistory(DAG);

// Variables for the pan-zoom state
var w = window.innerWidth,
    h = window.innerHeight,
    scale = 1,
    tx = 0,
    ty = 0;

// Sets the pan-zoom state of the graph and minimap according to the pan-zoom variables
var refreshViewport = function() {
    graphSVG.select(".graph").attr("transform","translate("+(tx*scale)+","+(ty*scale)+") scale("+scale+")");
    minimapSVG.select('.viewfinder').attr("x", -tx).attr("y", -ty).attr("width", w).attr("height", h);
    graphZoom.translate([tx*scale, ty*scale]).scale(scale);
    minimapZoom.translate([0,0]).scale(1);
    graphSVG.selectAll(".node text").attr("opacity", 3*scale-0.3);
}

// Resets the viewport by zooming all the way out
var resetViewport = function() {
    var bbox = graphSVG.select(".graph").node().getBBox();
    bbox.width += 50; bbox.height += 50;
    scale = Math.min(window.innerWidth/bbox.width, window.innerHeight/bbox.height);
    w = window.innerWidth/scale;
    h = window.innerHeight/scale;
    tx = (w - bbox.width)/2 - bbox.x + 25;
    ty = (h - bbox.height)/2 - bbox.y + 25;
    refreshViewport();
}

// Callback when graph is pan-zoomed
var onGraphPanzoom = function() {
    scale = d3.event.scale;
    tx = d3.event.translate[0] / scale;
    ty = d3.event.translate[1] / scale;
    w = window.innerWidth / scale;
    h = window.innerHeight / scale;
    refreshViewport();
}

// Callback when minimap is pan-zoomed
var onMinimapPanzoom = function() {
    var mouse = d3.mouse(minimapSVG.select(".minimap").node());
    tx = w/2-mouse[0];
    ty = h/2-mouse[1];
    refreshViewport();
}

// Create and call the graph pan-zoom behaviour
var graphZoom = d3.behavior.zoom().translate([0, 0]).scale(1.0).scaleExtent([0.05, 2.0]).on("zoom", onGraphPanzoom);
rootSVG.call(graphZoom).on("dblclick.zoom", null); // turn off double click zooming

// Create and call the minimap pan-zoom behaviour
var minimapZoom = d3.behavior.zoom().translate([0, 0]).scale(1.0).scaleExtent([1.0, 1.0]).on("zoom", onMinimapPanzoom);
minimapSVG.call(minimapZoom) // turn off double click zooming

// A function to attach tipsy tooltips to the graph nodes
function drawTooltips() {
    graphSVG.selectAll(".node").each(function(d) {
        $(this).tipsy({
            gravity: $.fn.tipsy.autoWE,
            html: true,
            title: function() {
                return createTooltipHTMLFromReport(d.report);
            }
        });
    });
}

function attachContextMenu() {
    $(".graph .node").unbind("contextmenu");
    $(".graph .node.selected").contextMenu('context-menu-1', {
        'Hide Selected Nodes': {
            click: function(element) { 
                history.addSelected(graphSVG);            
                d3.select(element.context).classed("hovered", false)
                graphSVG.classed("hovering", false);
                draw();
            },
        }
    }, { 
        disable_native_context_menu: true,
        showMenu: function(element) { $(".tipsy").remove(); },
    });
}

// A function that attaches mouse-click events to nodes to enable node selection
function setupEvents(){
    var nodes = graphSVG.selectAll(".node");
    var edges = graphSVG.selectAll(".edge");
    var items = listSVG.selectAll(".item");

    var lastSelected = null;
    nodes.on("click", function(d) { 
        var node = d3.select(this);
        var selected = !node.classed("selected");
        
        if (d3.event.ctrlKey && d3.event.shiftKey) {
            if (selected) {
                lastSelected = lastSelected || d;
                selectPath(d, lastSelected);    
            } else {
                node.classed("selected", selected);
                lastSelected = lastSelected==d ? null : lastSelected;
            }
        } else if (d3.event.ctrlKey) {
            node.classed("selected", selected);
            if (selected) {
                lastSelected = d;
            } else if (lastSelected==d) {
                lastSelected = null;
            }
        } else if (d3.event.shiftKey) {
            nodes.classed("selected", false);
            lastSelected = lastSelected || d;
            selectPath(d, lastSelected);
        } else {
            if (graphSVG.selectAll(".node.selected")[0].length==1) {
                nodes.classed("selected", false);
                node.classed("selected", selected);
                lastSelected = selected ? d : null;
            } else {
                nodes.classed("selected", false);
                node.classed("selected", true);
                lastSelected = d
            }
        }
        
        refreshEdges();
        attachContextMenu();
        $(".tipsy").remove();
    });
    graphSVG.node().oncontextmenu = function(d) { return false; };
    
    nodes.on("mouseover", function(d) {
        graphSVG.classed("hovering", true);
        highlightPath(d);
    }).on("mouseout", function(d){
        graphSVG.classed("hovering", false);
        edges.classed("hovered", false);
        edges.classed("hovered", false);
    });
    
    // When a list item is clicked, it will be removed from the history and added to the graph
    // So we override the DAG node transition behaviour so that the new nodes animate from the click position
    items.on("click", function(d, i) {
        // Calculate the click point
        var bbox = listSVG.node().getBBox();
        console.log(bbox);
        var startx = (bbox.x + bbox.width/2) / scale - tx;
        var starty = (bbox.y + DAGHistory.itemy().call(this, d, i) + 20) / scale - ty;
        var startscale = 0.8 / scale;
        var starttransform = "translate("+startx+","+starty+") scale("+startscale+")";

        // Update the new node transition to originate from this point
        DAG.newnodetransition(function(d) {
            d3.select(this).attr("transform", starttransform).transition().duration(800).attr("transform", DAG.nodeTranslate);
        })
        
        // Now remove and redraw
        history.remove(d);
        draw();
    })
    
    
    function selectPath(a, b) {
        var path = getNodesBetween(a, b).concat(getNodesBetween(b, a));
        graphSVG.selectAll(".node").data(path, DAG.nodeid()).classed("selected", true);
    }
    
    function refreshEdges() {
        // Class up the selected edges
        var selected = graphSVG.selectAll(".node.selected");
        var selectionIDs = {};
        selected.each(function(d) { selectionIDs[d.id] = true; });
        edges.classed("selected", function(d) {
            return selectionIDs[d.source.id]==true && selectionIDs[d.target.id]==true; 
        });
    }
    
    function highlightPath(center) {        
        var path = getEntirePath(center);
        
        var pathnodes = {};
        var pathlinks = {};
        
        path.forEach(function(p) {
           pathnodes[p.source.id] = true;
           pathnodes[p.target.id] = true;
           pathlinks[p.source.id+p.target.id] = true;
        });
        
        edges.classed("hovered", function(d) {
            return pathlinks[d.source.id+d.target.id];            
        })
        nodes.classed("hovered", function(d) {
            return pathnodes[d.id];
        });
    }
}

// The main draw function
function draw() {
    $(".tipsy").remove();               // Hide any tooltips
    listSVG.datum(history).call(DAGHistory);
    graphSVG.datum(graph).call(DAG);    // Draw a DAG at the graph attach
    minimapSVG.datum(graphSVG.node()).call(DAGMinimap);  // Draw a Minimap at the minimap attach
    drawTooltips();                     // Draw the tooltips
    setupEvents();                      // Set up the node selection events
    refreshViewport();
}

//Set a nice removenode animation
DAG.removenode(function(d) {
    // Calculate the current location of the history 
    var bbox = listSVG.node().getBBox();
    var targety = (bbox.y + 20) / scale - ty;
    var targetx = (bbox.x + bbox.width/2) / scale - tx;
    var targetscale = 0.5 / scale;
    
    // Slide the removed nodes over to the history
    var translate = "translate("+targetx+","+targety+") scale("+targetscale+")";
    d3.select(this).classed("visible", false).transition().duration(800).attr("transform", translate).remove();
});

//Call the draw function
draw();

// Start with the graph all the way zoomed out
resetViewport();

// Bind the delete key behaviour
d3.select("body").on("keyup", function(d) {
    if (d3.event.keyCode==46) {
        history.addSelected(graphSVG);            
        d3.select(this).classed("hovered", false)
        graphSVG.classed("hovering", false);
        draw();
    }
});
    
}