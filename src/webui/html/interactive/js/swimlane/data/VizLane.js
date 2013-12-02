var Lane = function(){};

Lane.prototype.Events = function() { return []; };
Lane.prototype.Spans = function() { return []; };
Lane.prototype.Threads = function() { return []; };
Lane.prototype.Processes = function() { return []; };
Lane.prototype.Tasks = function() { return []; };
Lane.prototype.Edges = function() { return []; };
Lane.prototype.GC = function() { return []; };
Lane.prototype.HDD = function() { return []; };

Lane.prototype.Height = function() { if (!arguments.length) return this.height ? this.height : 10; this.height = _; return this; };
Lane.prototype.Fill = function(_) { if (!arguments.length) return this.fill ? this.fill : 0; this.fill = _; return this; };
Lane.prototype.Offset = function(_) { if (!arguments.length) return this.offset ? this.offset : 0; this.offset = _; return this; };
Lane.prototype.Label = function(_) { if (!arguments.length) return this.label ? this.label : ""; this.label = _; return this; };

Lane.Scale = function(scale) {
  return {
    Height: function(lane) { return scale(lane.Height()); },
    Offset: function(lane) { return scale(lane.Offset()); }
  };
};
Lane.Fill = function(lane) { return lane.Fill(); };
Lane.Label = function(lane) { return lane.Label(); };

var ThreadLane = function(group, thread) {
  // Save the arguments
  this.group = group;
  this.thread = thread;
  
  // Set the thread label
  this.Label(thread.ShortName());
  
  // Save the lane on the events and spans
  var lane = this;
  this.Events().forEach(function(evt) { evt.lane = lane; });
  this.Spans().forEach(function(spn) { spn.lane = lane; });
  this.Edges().filter(function(edge) { return edge.parent.lane==lane; }).forEach(function(edge) { edge.type = "lane"; });
};
ThreadLane.prototype = new Lane();
ThreadLane.prototype.Events = function() { return this.thread.Events(); };
ThreadLane.prototype.Spans = function() { return this.thread.Spans(); };
ThreadLane.prototype.Edges = function() { return this.thread.Edges(); };
ThreadLane.prototype.HDD = function() { return this.thread.HDDEvents(); };