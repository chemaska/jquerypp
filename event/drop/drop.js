steal.plugins('jquery/event/drag','jquery/dom/within','jquery/dom/compare').then(function($){
	var event = $.event, 
		callHanders = function(){
			
		};
	//somehow need to keep track of elements with selectors on them.  When element is removed, somehow we need to know that
	//
	/**
	 * @add jQuery.event.special static
	 */
	var eventNames = [
	/**
	 * @attribute dropover
	 */
	"dropover",
	/**
	 * @attribute dropon
	 */
	"dropon",
	/**
	 * @attribute dropout
	 */
	"dropout",
	/**
	 * @attribute dropinit
	 */
	"dropinit",
	/**
	 * @attribute dropmove
	 */
	"dropmove",
	/**
	 * @attribute dropend
	 */
	"dropend"];
	//register each event as a basicProcessor
	if($.Controller){
		$.each(eventNames,function(){
			$.Controller.processors[this] = jQuery.Controller.basicProcessor;
		})
	}
	
	/**
	 * @class jQuery.Drop
	 */
	$.Drop = function(callbacks, element){
		jQuery.extend(this,callbacks);
		this.element = element;
	}
	$.each(eventNames, function(){
			event.special[this] = {
				add : function(handleObj){
					//add this element to the compiles list
					var el = $(this), current = (el.data("dropEventCount") || 0);
					el.data("dropEventCount",  current+1   )
					if(current==0){
						$.Drop.addElement(this);
					}
				},
				remove : function(){
					var el = $(this), current = (el.data("dropEventCount") || 0);
					el.data("dropEventCount",  current-1   )
					if(current<=1){
						$.Drop.removeElement(this);
					}
				}
			}
	})
	$.extend($.Drop,{
		lowerName: "drop",
		_elements: [], //elements that are listening for drops
		_responders: [], //potential drop points
		last_active: [],
		endName: "dropon",
		addElement : function(el){
			//check other elements
			for(var i =0; i < this._elements.length ; i++  ){
				if(el ==this._elements[i]) return;
			}
			this._elements.push(el);
		},
		removeElement : function(el){
			 for(var i =0; i < this._elements.length ; i++  ){
				if(el == this._elements[i]){
					this._elements.splice(i,1)
					return;
				}
			}
		},
		/**
		* @hide
		* For a list of affected drops, sorts them by which is deepest in the DOM first.
		*/ 
		sortByDeepestChild: function(a, b) {
			var compare = a.element.compare(b.element);
			if(compare & 16 || compare & 4) return 1;
			if(compare & 8 || compare & 2) return -1;
			return 0;
		},
		/**
		 * @hide
		 * Tests if a drop is within the point.
		 */
		isAffected: function(point, moveable, responder) {
			return ((responder.element != moveable.element) && (responder.element.within(point[0], point[1], responder).length == 1));
		},
		/**
		 * @hide
		 * Calls dropout and sets last active to null
		 * @param {Object} drop
		 * @param {Object} drag
		 * @param {Object} event
		 */
		deactivate: function(responder, mover, event) {
			responder.callHandlers(this.lowerName+'out',responder.element[0], event, mover)
		}, 
		/**
		 * @hide
		 * Calls dropover
		 * @param {Object} drop
		 * @param {Object} drag
		 * @param {Object} event
		 */
		activate: function(responder, mover, event) { //this is where we should call over
			//this.last_active = responder;
			responder.callHandlers(this.lowerName+'over',responder.element[0], event, mover)
		},
		move : function(responder, mover, event){
			responder.callHandlers(this.lowerName+'move',responder.element[0], event, mover)
		},
		/**
		 * Gets all elements that are droppable, adds them
		 */
		compile : function(event, drag){
			var el, drops, selector, sels;
			this.last_active = [];
			for(var i=0; i < this._elements.length; i++){ //for each element
				el = this._elements[i]
				var drops = $.event.findBySelector(el, eventNames)

				for(selector in drops){ //find the selectors
					sels = selector ? jQuery(selector, el) : [el];
					for(var e= 0; e < sels.length; e++){ //for each found element, create a drop point
						jQuery.removeData(sels[e],"offset");
						this.add(sels[e], new this(drops[selector]), event, drag);
					}
				}
			}
			
		},
		add: function(element, callbacks, event, drag) {
			element = jQuery(element);
			var responder = new $.Drop(callbacks, element);
			responder.callHandlers(this.lowerName+'init', element[0], event, drag)
			if(!responder._canceled){
				this._responders.push(responder);
			}
		},
		show : function(point, moveable, event){
			var element = moveable.element;
			if(!this._responders.length) return;
			
			var respondable, 
				affected = [], 
				propagate = true, 
				i,j, la, toBeActivated, aff, 
				oldLastActive = this.last_active;
				
			for(var d =0 ; d < this._responders.length; d++ ){
				
				if(this.isAffected(point, moveable, this._responders[d])){
					affected.push(this._responders[d]);  
				}
					 
			}
			
			affected.sort(this.sortByDeepestChild); //we should only trigger on lowest children
			event.stopRespondPropagate = function(){
				propagate = false;
			}
			//deactivate everything in last_active that isn't active
			toBeActivated = affected.slice();
			this.last_active = affected;
			for (j = 0; j < oldLastActive.length; j++) {
				la = oldLastActive[j]
				i = 0;
				while((aff = toBeActivated[i])){
					if(la == aff){
						toBeActivated.splice(i,1);break;
					}else{
						i++;
					}
				}
				if(!aff){
					this.deactivate(la, moveable, event);
				}
				if(!propagate) return;
			}
			for(var i =0; i < toBeActivated.length; i++){
				this.activate(toBeActivated[i], moveable, event);
				if(!propagate) return;
			}
			//activate everything in affected that isn't in last_active
			
			for (i = 0; i < affected.length; i++) {
				this.move(affected[i], moveable, event);
				
				if(!propagate) return;
			}
		},
		end : function(event, moveable){
			var responder, la;
			for(var r =0; r<this._responders.length; r++){
				this._responders[r].callHandlers(this.lowerName+'end', null, event, moveable);
			}
			//go through the actives ... if you are over one, call dropped on it
			for(var i = 0; i < this.last_active.length; i++){
				la = this.last_active[i]
				if( this.isAffected(event.vector(), moveable, la)  && la[this.endName]){
					la.callHandlers(this.endName, null, event, moveable);
				}
			}
			
			
			this.clear();
		},
		/**
		 * Called after dragging has stopped.
		 */
		clear : function(){
		  
		  this._responders = [];
		}
	})
	$.Drag.responder = $.Drop;
	
	$.extend($.Drop.prototype,{
		callHandlers : function(method, el, ev, drag){
			var length = this[method] ? this[method].length : 0
			for(var i =0; i < length; i++){
				this[method][i].call(el || this.element[0], ev, this, drag)
			}
		},
		/**
		 * Caches positions of draggable elements.  This should be called in dropinit.  For example:
		 * @codestart
		 * dropinit : function(el, ev, drop){ drop.cache_position() }
		 * @codeend
		 */
		cache: function(value){
			this._cache = value != null ? value : true;
		},
		/**
		 * Prevents this drop from being dropped on.
		 */
		cancel : function(){
			this._canceled = true;
		}
	} )
});