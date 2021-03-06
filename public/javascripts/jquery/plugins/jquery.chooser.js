// Roughly based on http://jqueryui.com/demos/autocomplete/#combobox
(function( $ ) {
  $.widget( "ui.chooser", {
    options: {
      choiceClass: 'ui-widget ui-widget-content ui-corner-left inlineblock ui-chooser-choice',
      inputClass:  'ui-widget ui-widget-content ui-corner-left inlineblock ui-chooser-input',
      buttonClass: 'ui-corner-right ui-chooser-button ui-button-icon inlineblock',
      queryParam: 'term'
    },
    _create: function() {
      var self = this,
          source = this.options.source,
          collectionUrl = this.options.collectionUrl,
          cache = {},
          defaultSources = this.options.defaultSources || $.parseJSON($(this.element).attr('data-chooser-default-sources'))
      if (!collectionUrl && typeof(this.options.source) == 'string') {
        collectionUrl = this.options.collectionUrl = this.options.source
      }
      this.defaultSources = defaultSources = this.recordsToItems(defaultSources)
      this.options.source = this.options.source || defaultSources
      var markup = this.setupMarkup()
      
      this.selectDefault()
      
      markup.input.autocomplete({
        html: true,
        minLength: 0,
        select: function(ui, event) {
          if (event.item.forceRemote) {
            self.options.source = collectionUrl
            $(ui.target).autocomplete('search', ui.target.value)
          } else {
            self.selectItem(event.item)
          }
          return false
        },
        source: function(request, response) {
          var source = self.options.source
          if (request.term == '' && typeof(source) == 'string') {
            source = self.options.source = self.defaultSources
          }
          if (typeof(source) != 'string') {
            var matcher = new RegExp( $.ui.autocomplete.escapeRegex(request.term), "i" );
            var selected = $.map(source, function(src) {
              if (src.forceRemote || matcher.test(src.label)) { return src }
            })
            if (selected.length != 0 && collectionUrl) {
              selected.push({label: '<em>Search remote</em>', value: request.term, forceRemote: true})
              response(selected)
              return
            } else {
              response([])
            }
          }
          if (cache[request.term]) {
            response(cache[request.term])
            return
          }
          
          if (!collectionUrl) { return };
          
          markup.chooseButton.hide()
          markup.loadingButton.showInlineBlock()
          
          $.getJSON(collectionUrl, self.options.queryParam+"="+request.term, function(json) {
            markup.chooseButton.showInlineBlock()
            markup.loadingButton.hide()
            json = self.recordsToItems(json)
            cache[request.term] = json
            response(json)
          })
        }
      })
      
      // bind button behaviors
      markup.clearButton.click(function() {
        self.clear()
      })
      
      markup.chooseButton.click(function() {
        // close if already visible
        if (markup.input.autocomplete( "widget" ).is( ":visible" )) {
          markup.input.autocomplete( "close" )
          return
        }

        // work around a bug (likely same cause as #5265)
        $( this ).blur()

        // pass empty string as value to search for, displaying all results
        markup.input.autocomplete( "search", "" )
        markup.input.focus()
      })
    },
    
    selectDefault: function() {
      var self = this, markup = this.markup
      if ($(this.element).attr('data-chooser-chosen')) {
        var item = $.parseJSON($(this.element).attr('data-chooser-chosen'))
        item = self.recordsToItems([item])[0]
        this.selectItem(item)
      } else if ($(this.element).val() != '' && this.options.resourceUrl) {
        markup.chooseButton.hide()
        markup.loadingButton.showInlineBlock()
        var resourceUrl = this.options.resourceUrl.replace(/\{\{id\}\}/, $(this.element).val())
        $.getJSON(resourceUrl, function(json) {
          var item = self.recordsToItems([json])[0]
          markup.loadingButton.hide()
          self.selectItem(item)
        })
      }
    },
    
    recordsToItems: function(records) {
      var items = [], records = records || []
      for (var i=0; i < records.length; i++) {
        if (!records[i]) { continue }
        items.push(
          $.extend(records[i], {
            label: records[i].label || records[i].html || records[i].title || records[i].name,
            value: records[i].value || records[i].title || records[i].name || records[i].id,
            recordId: records[i].id
          })
        )
      }
      return items
    },
    
    selectItem: function(item) {
      if (!item) {
        this.clear()
        return
      }
      $(this.markup.input).hide()
      $(this.markup.choice).width('auto')
      $(this.markup.choice).html(item.label || item.html).showInlineBlock()
      $(this.markup.chooseButton).hide()
      $(this.markup.clearButton).showInlineBlock()
      $(this.markup.clearButton)
        .height(this.markup.choice.outerHeight())
      $('.ui-icon', this.markup.clearButton)
        .css('margin-top', '-' + Math.round((this.markup.choice.outerHeight() / 2) - 6) + 'px')
      $(this.markup.originalInput).val(item.recordId || item.value || item.id)
    },
    
    clear: function() {
      $(this.markup.input).val('').showInlineBlock()
      $(this.markup.choice).html('').hide()
      $(this.markup.chooseButton).showInlineBlock()
      $(this.markup.clearButton).hide()
    },
    
    setupMarkup: function() {
      var originalInput = this.element.hide()
      this.markup = {
        originalInput: originalInput,
        input: $('<input type="text"/>')
          .addClass(this.options.inputClass)
          .attr('id', 'existing_source_id')
          .attr('placeholder', originalInput.attr('placeholder')),
        choice: $('<div></div>')
          .addClass(this.options.choiceClass)
          .hide(),
        chooseButton: $('<button type="button">&nbsp;</button>')
          .button({
            icons: {
              primary: "ui-icon-triangle-1-s"
            },
            text: false
          })
          .removeClass( "ui-corner-all" )
          .addClass(this.options.buttonClass),
        clearButton: $('<button type="button">&nbsp;</button>')
          .button({
            icons: {
              primary: "ui-icon-cancel"
            },
            text: false
          })
          .removeClass( "ui-corner-all" )
          .addClass(this.options.buttonClass)
          .hide(),
        loadingButton: $('<button type="button" disabled="disabled">&nbsp;</button>')
          .button({
            text: false,
            disabled: true
          })
          .removeClass( "ui-corner-all" )
          .addClass(this.options.buttonClass + ' ui-icon-loading')
          .hide()
      }
      this.markup.originalInput.after(
        this.markup.input, 
        this.markup.choice, 
        this.markup.chooseButton, 
        this.markup.loadingButton, 
        this.markup.clearButton)
      return this.markup
    },
    destroy: function() {
      this.markup.input.remove()
      this.markup.choice.remove()
      this.markup.chooseButton.remove()
      this.markup.loadingButton.remove()
      this.markup.clearButton.remove()
      
      this.element.show();
      $.Widget.prototype.destroy.call( this );
    }
  })
})( jQuery )
