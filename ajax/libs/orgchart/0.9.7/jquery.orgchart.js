/*
 * jQuery OrgChart Plugin
 * https://github.com/dabeng/OrgChart
 *
 * Demos of jQuery OrgChart Plugin
 * http://dabeng.github.io/OrgChart/local-datasource/
 * http://dabeng.github.io/OrgChart/ajax-datasource/
 * http://dabeng.github.io/OrgChart/ondemand-loading-data/
 * http://dabeng.github.io/OrgChart/option-createNode/
 * http://dabeng.github.io/OrgChart/export-orgchart/
 * http://dabeng.github.io/OrgChart/integrate-map/
 *
 * Copyright 2016, dabeng
 * http://dabeng.github.io/
 *
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/MIT
 */

(function($) {
  'use strict';

  $.fn.orgchart = function(options) {
    var defaultOptions = {
      'nodeRelationship': 'relationship',
      'nodeChildren': 'children',
      'depth': 999,
      'chartClass': '',
      'exportButton': false,
      'exportFilename': 'OrgChart',
      'parentNodeSymbol': 'fa-users'
    };

    switch (options) {
      case 'buildHierarchy':
        return buildHierarchy.apply(this, Array.prototype.splice.call(arguments, 1));
      case 'addChildren':
        return addChildren.apply(this, Array.prototype.splice.call(arguments, 1));
      case 'addParent':
        return addParent.apply(this, Array.prototype.splice.call(arguments, 1));
      case 'addSiblings':
        return addSiblings.apply(this, Array.prototype.splice.call(arguments, 1));
      case 'removeNodes':
        return removeNodes.apply(this, Array.prototype.splice.call(arguments, 1));
      default: // initiation time
        var opts = $.extend(defaultOptions, options);
        this.data('orgchart', { 'options' : opts });
    }

    // build the org-chart
    var $chartContainer = this;
    var data = opts.data;
    var $chart = $('<div>', {
      'class': 'orgchart' + (opts.chartClass !== '' ? ' ' + opts.chartClass : ''),
      'click': function(event) {
        if (!$(event.target).closest('.node').length) {
          $chart.find('.node.focused').removeClass('focused');
        }
      }
    });
    if ($.type(data) === 'object') {
      buildHierarchy($chart, data, 0, opts);
    } else {
      $.ajax({
        'url': data,
        'beforeSend': function () {
          $chart.append('<i class="fa fa-circle-o-notch fa-spin spinner"></i>');
        }
      })
      .done(function(data, textStatus, jqXHR) {
        buildHierarchy($chart, data, 0, opts);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        console.log(errorThrown);
      })
      .always(function() {
        $chart.children('.spinner').remove();
      });
    }
    $chartContainer.append($chart);

    // append the export button
    if (opts.exportButton) {
      var $exportBtn = $('<button>', {
        'class': 'oc-export-btn' + (opts.chartClass !== '' ? ' ' + opts.chartClass : ''),
        'text': 'Export',
        'click': function() {
          if ($(this).children('.spinner').length) {
            return false;
          }
          var $mask = $chartContainer.find('.mask');
          if (!$mask.length) {
            $chartContainer.append('<div class="mask"><i class="fa fa-circle-o-notch fa-spin spinner"></i></div>');
          } else {
            $mask.removeClass('hidden');
          }
          html2canvas($chart[0], {
            'onrendered': function(canvas) {
              $chartContainer.find('.mask').addClass('hidden')
                .end().find('.oc-download-btn').attr('href', canvas.toDataURL())[0].click();
            }
          });
        }
      });
      var downloadBtn = '<a class="oc-download-btn' + (opts.chartClass !== '' ? ' ' + opts.chartClass : '') + '"'
        + ' download="' + opts.exportFilename + '.png"></a>';
      $chartContainer.append($exportBtn).append(downloadBtn);
    }

    return $chartContainer;
  };

  // detect the exist/display state of related node
  function getNodeState($node, relation) {
    var $target = {};
    if (relation === 'parent') {
      $target = $node.closest('table').closest('tr').siblings(':first').find('.node');
    } else if (relation === 'children') {
      $target = $node.closest('tr').siblings();
    } else {
      $target = $node.closest('table').parent().siblings();
    }
    if ($target.length) {
      if ($target.is(':visible')) {
        return {"exist": true, "visible": true};
      }
      return {"exist": true, "visible": false};
    }
    return {"exist": false, "visible": false};
  }

  // recursively hide the ancestor node and sibling nodes of the specified node
  function hideAncestorsSiblings($node) {
    var $temp = $node.closest('table').closest('tr').siblings();
    if ($temp.eq(0).find('.spinner').length) {
      $node.closest('.orgchart').data('inAjax', false);
    }
    // hide the sibling nodes
    if (getNodeState($node, 'siblings').visible) {
      hideSiblings($node);
    }
    // hide the lines
    var $lines = $temp.slice(1);
    $lines.css('visibility', 'hidden');
    // hide the superior nodes with transition
    var $parent = $temp.eq(0).find('.node');
    var grandfatherVisible = getNodeState($parent, 'parent').visible;
    if ($parent.length && $parent.is(':visible')) {
      $parent.addClass('slide slide-down').one('transitionend', function() {
        $parent.removeClass('slide');
        $lines.removeAttr('style');
        $temp.addClass('hidden');
      });
    }
    // if the current node has the parent node, hide it recursively
    if ($parent.length && grandfatherVisible) {
      hideAncestorsSiblings($parent);
    }
  }

  // show the parent node of the specified node
  function showParent($node) {
    // just show only one superior level
    var $temp = $node.closest('table').closest('tr').siblings().removeClass('hidden');
    // just show only one line
    $temp.eq(2).children().slice(1, -1).addClass('hidden');
    // show parent node with animation
    var parent = $temp.eq(0).find('.node')[0];
    repaint(parent);
    $(parent).addClass('slide').removeClass('slide-down').one('transitionend', function() {
      $(parent).removeClass('slide');
      if (isInAction($node)) {
        switchVerticalArrow($node.children('.topEdge'));
      }
    });
  }

  // recursively hide the descendant nodes of the specified node
  function hideDescendants($node) {
    var $temp = $node.closest('tr').siblings();
    if ($temp.last().find('.spinner').length) {
      $node.closest('.orgchart').data('inAjax', false);
    }
    var $visibleNodes = $temp.last().find('.node:visible');
    var $lines = $visibleNodes.closest('table').closest('tr').prevAll('.lines').css('visibility', 'hidden');
    $visibleNodes.addClass('slide slide-up').eq(0).one('transitionend', function() {
      $visibleNodes.removeClass('slide');
      $lines.removeAttr('style').addClass('hidden').siblings('.nodes').addClass('hidden');
      if (isInAction($node)) {
        switchVerticalArrow($node.children('.bottomEdge'));
      }
    });
  }

  // show the children nodes of the specified node
  function showDescendants($node) {
    var $descendants = $node.closest('tr').siblings().removeClass('hidden')
      .eq(2).children().find('tr:first').find('.node:visible');
    // the two following statements are used to enforce browser to repaint
    repaint($descendants.get(0));
    $descendants.addClass('slide').removeClass('slide-up').eq(0).one('transitionend', function() {
      $descendants.removeClass('slide');
      if (isInAction($node)) {
        switchVerticalArrow($node.children('.bottomEdge'));
      }
    });
  }

  // hide the sibling nodes of the specified node
  function hideSiblings($node) {
    var $nodeContainer = $node.closest('table').parent();
    if ($nodeContainer.siblings().find('.spinner').length) {
      $node.closest('.orgchart').data('inAjax', false);
    }
    $nodeContainer.prevAll().find('.node:visible').addClass('slide slide-right');
    $nodeContainer.nextAll().find('.node:visible').addClass('slide slide-left');
    var $animatedNodes = $nodeContainer.siblings().find('.slide');
    var $lines = $animatedNodes.closest('.nodes').prevAll('.lines').css('visibility', 'hidden');
    $animatedNodes.eq(0).one('transitionend', function() {
      $lines.removeAttr('style');
      $nodeContainer.closest('.nodes').prev().children().slice(1, -1).addClass('hidden');
      $animatedNodes.removeClass('slide');
      $nodeContainer.siblings().find('.node:visible:gt(0)').removeClass('slide-left slide-right').addClass('slide-up');
      $nodeContainer.siblings().find('.lines, .nodes').addClass('hidden');
      $nodeContainer.siblings().addClass('hidden');
      if (isInAction($node)) {
        switchHorizontalArrow($node, true);
      }
    });
  }

  // show the sibling nodes of the specified node
  function showSiblings($node) {
    // firstly, show the sibling td tags
    var $siblings = $node.closest('table').parent().siblings().removeClass('hidden');
    // secondly, show the lines
    var $upperLevel = $node.closest('table').closest('tr').siblings();
    $upperLevel.eq(2).children().slice(1, -1).removeClass('hidden');
    // thirdly, do some cleaning stuff
    if (!getNodeState($node, 'parent').visible) {
      $upperLevel.removeClass('hidden');
      var parent = $upperLevel.find('.node')[0];
      repaint(parent);
      $(parent).addClass('slide').removeClass('slide-down').one('transitionend', function() {
        $(this).removeClass('slide');
      });
    }
    // lastly, show the sibling nodes with animation
    $siblings.find('.node:visible').addClass('slide').removeClass('slide-left slide-right').eq(-1).one('transitionend', function() {
      $siblings.find('.node:visible').removeClass('slide');
      if (isInAction($node)) {
        collapseArrow($node);
      }
    });
  }

  // start up loading status for requesting new nodes
  function startLoading($arrow, $node, options) {
    var $chart = $node.closest('.orgchart');
    if (typeof $chart.data('inAjax') !== 'undefined' && $chart.data('inAjax') === true) {
      return false;
    }

    $arrow.addClass('hidden');
    $node.append('<i class="fa fa-circle-o-notch fa-spin spinner"></i>');
    $node.children().not('.spinner').css('opacity', 0.2);
    $chart.data('inAjax', true);
    $('.oc-export-btn' + (options.chartClass !== '' ? '.' + options.chartClass : '')).prop('disabled', true);
    return true;
  }

  // terminate loading status for requesting new nodes
  function endLoading($arrow, $node, options) {
    var $chart = $node.closest('div.orgchart');
    $arrow.removeClass('hidden');
    $node.find('.spinner').remove();
    $node.children().removeAttr('style');
    $chart.data('inAjax', false);
    $('.oc-export-btn' + (options.chartClass !== '' ? '.' + options.chartClass : '')).prop('disabled', false);
  }

  // whether the cursor is hovering over the node
  function isInAction($node) {
    return $node.children('.edge').attr('class').indexOf('fa-') > -1 ? true : false;
  }

  function switchVerticalArrow($arrow) {
    $arrow.toggleClass('fa-chevron-up').toggleClass('fa-chevron-down');
  }

  function collapseArrow($node) {
    switchHorizontalArrow($node, false);
    $node.children('.topEdge').removeClass('fa-chevron-up').addClass('fa-chevron-down');
  }

  function switchHorizontalArrow($node, isExpand) {
    $node.children('.leftEdge').toggleClass('fa-chevron-right', !isExpand).toggleClass('fa-chevron-left', isExpand);
    $node.children('.rightEdge').toggleClass('fa-chevron-left', !isExpand).toggleClass('fa-chevron-right', isExpand);
  }

  function repaint(node) {
    node.style.offsetWidth = node.offsetWidth;
  }

  // create node
  function createNode(nodeData, level, opts) {
    var dtd = $.Deferred();
    // construct the content of node
    var $nodeDiv = $('<div>', { 'id': nodeData[opts.nodeId] })
      .addClass('node' + (level >= opts.depth ? ' slide-up' : ''))
      .append('<div class="title">' + nodeData[opts.nodeTitle] + '</div>')
      .append(typeof opts.nodeContent !== 'undefined' ? '<div class="content">' + nodeData[opts.nodeContent] + '</div>' : '');
    // append 4 directions arrows
    var flags = nodeData[opts.nodeRelationship];
    if (Number(flags.substr(0,1))) {
      $nodeDiv.append('<i class="edge verticalEdge topEdge fa"></i>');
    }
    if(Number(flags.substr(1,1))) {
      $nodeDiv.append('<i class="edge horizontalEdge rightEdge fa"></i>' +
        '<i class="edge horizontalEdge leftEdge fa"></i>');
    }
    if(Number(flags.substr(2,1))) {
      $nodeDiv.append('<i class="edge verticalEdge bottomEdge fa"></i>')
        .children('.title').prepend('<i class="fa '+ opts.parentNodeSymbol + ' symbol"></i>');
    }

    $nodeDiv.on('mouseenter mouseleave', function(event) {
      var $node = $(this), flag = false;
      var $topEdge = $node.children('.topEdge');
      var $rightEdge = $node.children('.rightEdge');
      var $bottomEdge = $node.children('.bottomEdge');
      var $leftEdge = $node.children('.leftEdge');
      if (event.type === 'mouseenter') {
        if ($topEdge.length) {
          flag = getNodeState($node, 'parent').visible;
          $topEdge.toggleClass('fa-chevron-up', !flag).toggleClass('fa-chevron-down', flag);
        }
        if ($bottomEdge.length) {
          flag = getNodeState($node, 'children').visible;
          $bottomEdge.toggleClass('fa-chevron-down', !flag).toggleClass('fa-chevron-up', flag);
        }
        if ($leftEdge.length) {
          switchHorizontalArrow($node, !getNodeState($node, 'siblings').visible);
        }
      } else {
        $node.children('.edge').removeClass('fa-chevron-up fa-chevron-down fa-chevron-right fa-chevron-left');
      }
    });

    // define click event handler
    $nodeDiv.on('click', function(event) {
      $(this).closest('.orgchart').find('.focused').removeClass('focused');
      $(this).addClass('focused');
    });

    // define click event handler for the top edge
    $nodeDiv.on('click', '.topEdge', function(event) {
      var $that = $(this);
      var $node = $that.parent();
      var parentState = getNodeState($node, 'parent');
      if (parentState.exist) {
        var $parent = $node.closest('table').closest('tr').siblings(':first').find('.node');
        if ($parent.is('.slide')) { return; }
        // hide the ancestor nodes and sibling nodes of the specified node
        if (parentState.visible) {
          hideAncestorsSiblings($node);
          $parent.one('transitionend', function() {
            if (isInAction($node)) {
              switchVerticalArrow($that);
              switchHorizontalArrow($node, true);
            }
          });
        } else { // show the ancestors and siblings
          showParent($node);
        }
      } else {
        // load the new parent node of the specified node by ajax request
        var nodeId = $that.parent()[0].id;
        // start up loading status
        if (startLoading($that, $node, opts)) {
        // load new nodes
          $.ajax({ 'url': opts.ajaxURL.parent + nodeId + '/' })
          .done(function(data) {
            if ($node.closest('div.orgchart').data('inAjax')) {
              if (!$.isEmptyObject(data)) {
                addParent($node, data, opts);
              }
            }
          })
          .fail(function() { console.log('Failed to get parent node data'); })
          .always(function() { endLoading($that, $node, opts); });
        }
      }
    });

    // bind click event handler for the bottom edge
    $nodeDiv.on('click', '.bottomEdge', function(event) {
      var $that = $(this);
      var $node = $that.parent();
      var childrenState = getNodeState($node, 'children');
      if (childrenState.exist) {
        var $children = $node.closest('tr').siblings(':last');
        if ($children.find('.node:visible').is('.slide')) { return; }
        // hide the descendant nodes of the specified node
        if (childrenState.visible) {
          hideDescendants($node);
        } else { // show the descendants
          showDescendants($node);
        }
      } else { // load the new children nodes of the specified node by ajax request
        var nodeId = $that.parent()[0].id;
        if (startLoading($that, $node, opts)) {
          $.ajax({ 'url': opts.ajaxURL.children + nodeId + '/' })
          .done(function(data, textStatus, jqXHR) {
            if ($node.closest('.orgchart').data('inAjax')) {
              if (data.children.length) {
                addChildren($node, data, $.extend({}, opts, { depth: 0 }));
              }
            }
          })
          .fail(function(jqXHR, textStatus, errorThrown) {
            console.log('Failed to get children nodes data');
          })
          .always(function() {
            endLoading($that, $node, opts);
          });
        }
      }
    });

    // bind click event handler for the left and right edges
    $nodeDiv.on('click', '.leftEdge, .rightEdge', function(event) {
      var $that = $(this);
      var $node = $that.parent();
      var siblingsState = getNodeState($node, 'siblings');
      if (siblingsState.exist) {
        var $siblings = $node.closest('table').parent().siblings();
        if ($siblings.find('.node:visible').is('.slide')) { return; }
        if (siblingsState.visible) { // hide the sibling nodes of the specified node
          hideSiblings($node);
        } else { // show the siblings
          showSiblings($node);
        }
      } else {
        // load the new sibling nodes of the specified node by ajax request
        var nodeId = $that.parent()[0].id;
        var url = (getNodeState($node, 'parent').exist) ? opts.ajaxURL.siblings : opts.ajaxURL.families;
        if (startLoading($that, $node, opts)) {
          $.ajax({ 'url': url + nodeId + '/' })
          .done(function(data, textStatus, jqXHR) {
            if ($node.closest('.orgchart').data('inAjax')) {
              if (data.siblings || data.children) {
                addSiblings($node, data, opts);
              }
            }
          })
          .fail(function(jqXHR, textStatus, errorThrown) {
            console.log('Failed to get sibling nodes data');
          })
          .always(function() {
            endLoading($that, $node, opts);
          });
        }
      }
    });
    // remedy the defect of css selector -- there is not "previous sibling" selector
    $nodeDiv.children('.leftEdge').on('mouseenter mouseleave', function(event) {
      if (event.type === 'mouseenter') {
        var $rightEdge = $(this).siblings('.rightEdge');
        if (!getNodeState($(this), 'siblings').visible) {
          $rightEdge.addClass('rightEdgeMoveRight');
        } else {
          $rightEdge.addClass('rightEdgeMoveLeft');
        }
      } else {
        $(this).siblings('.rightEdge').removeClass('rightEdgeMoveRight rightEdgeMoveLeft');
      }
    });
    // allow user to append dom modification after finishing node create of orgchart 
    if (opts.createNode) {
      opts.createNode($nodeDiv, nodeData);
    }
    dtd.resolve($nodeDiv);
    return dtd.promise();
  }
  // recursively build the tree
  function buildHierarchy ($appendTo, nodeData, level, opts, callback) {
    var $table;
    // Construct the node
    var $childNodes = nodeData[opts.nodeChildren];
    var hasChildren = $childNodes ? $childNodes.length : false;
    if (Object.keys(nodeData).length > 1) { // if nodeData has nested structure
      $table = $('<table>');
      $appendTo.append($table);
      $.when(createNode(nodeData, level, opts))
      .done(function($nodeDiv) {
        $table.append($nodeDiv.wrap('<tr><td' + (hasChildren ? ' colspan="' + $childNodes.length * 2 + '"' : '') + '></td></tr>').closest('tr'));
        if (callback) {
          callback();
        }
      })
      .fail(function() {
        console.log('Failed to creat node')
      });
    }
    // Construct the inferior nodes and connectiong lines
    if (hasChildren) {
      if (Object.keys(nodeData).length === 1) { // if nodeData is just an array
        $table = $appendTo;
      }
      var isHidden = level + 1 >= opts.depth ? ' hidden' : '';
      // draw the line close to parent node
      $table.append('<tr class="lines' + isHidden + '"><td colspan="' + $childNodes.length * 2 + '"><div class="down"></div></td></tr>');
      // draw the lines close to children nodes
      var linesRow = '<tr class="lines' + isHidden + '"><td class="right">&nbsp;</td>';
      for (var i=1; i<$childNodes.length; i++) {
        linesRow += '<td class="left top">&nbsp;</td><td class="right top">&nbsp;</td>';
      }
      linesRow += '<td class="left">&nbsp;</td></tr>';
      $table.append(linesRow);
      // recurse through children nodes
      var $childNodesRow = $('<tr class="nodes' + isHidden + '">');
      $table.append($childNodesRow);
      $.each($childNodes, function() {
        var $td = $('<td colspan="2">');
        $childNodesRow.append($td);
        buildHierarchy($td, this, level + 1, opts, callback);
      });
    }
  }

  // build the child nodes of specific node
  function buildChildNode ($appendTo, nodeData, opts, callback) {
    var opts = opts || this.data('orgchart').options;
    var data = nodeData.children || nodeData.siblings;
    $appendTo.find('td:first').attr('colspan', data.length * 2);
    buildHierarchy($appendTo, { 'children': data }, 0, opts, callback);
  }
  // exposed method
  function addChildren($node, data, opts) {
    var count = 0;
    buildChildNode.call($node.closest('.orgchart').parent(), $node.closest('table'), data, opts, function() {
      if (++count === data.children.length) {
        if (!$node.children('.bottomEdge').length) {
          $node.append('<i class="edge verticalEdge bottomEdge fa"></i>');
        }
        if (!$node.children('.symbol').length) {
          $node.children('.title').prepend('<i class="fa '+ opts.parentNodeSymbol + ' symbol"></i>');
        }
        showDescendants($node);
      }
    });
  }

  // build the parent node of specific node
  function buildParentNode(nodeData, opts, callback) {
    var that = this;
    var $table = $('<table>');
    nodeData[(opts && opts.nodeRelationship) ? opts.nodeRelationship : 'relationship'] = '001';
    $.when(createNode(nodeData, 0, opts ? opts : this.data('orgchart').options))
      .done(function($nodeDiv) {
        $table.append($nodeDiv.removeClass('slide-up').addClass('slide-down').wrap('<tr class="hidden"><td colspan="2"></td></tr>').closest('tr'));
        $table.append('<tr class="lines hidden"><td colspan="2"><div class="down"></div></td></tr>');
        var linesRow = '<td class="right">&nbsp;</td><td class="left">&nbsp;</td>';
        $table.append('<tr class="lines hidden">' + linesRow + '</tr>');
        var oc = that.children('.orgchart');
        oc.prepend($table)
          .children('table:first').append('<tr class="nodes"><td colspan="2"></td></tr>')
          .children().children('tr:last').children().append(oc.children('table').last());
        callback();
      })
      .fail(function() {
        console.log('Failed to create parent node');
      });
  }

  // exposed method
  function addParent($node, data, opts) {
    buildParentNode.call($node.closest('.orgchart').parent(), data, opts, function() {
      if (!$node.children('.topEdge').length) {
        $node.children('.title').after('<i class="edge verticalEdge topEdge fa"></i>');
      }
      showParent($node);
    });
  }

  // subsequent processing of build sibling nodes
  function complementLine($oneSibling, siblingCount, existingSibligCount) {
    var lines = '';
    for (var i = 0; i < existingSibligCount; i++) {
      lines += '<td class="left top">&nbsp;</td><td class="right top">&nbsp;</td>';
    }
    $oneSibling.parent().prevAll('tr:gt(0)').children().attr('colspan', siblingCount * 2)
      .end().next().children(':first').after(lines);
  }

  // build the sibling nodes of specific node
  function buildSiblingNode($nodeChart, nodeData, opts, callback) {
    var opts = opts || this.data('orgchart').options;
    var newSiblingCount = nodeData.siblings ? nodeData.siblings.length : nodeData.children.length;
    var existingSibligCount = $nodeChart.parent().is('td') ? $nodeChart.closest('tr').children().length : 1;
    var siblingCount = existingSibligCount + newSiblingCount;
    var insertPostion = (siblingCount > 1) ? Math.floor(siblingCount/2 - 1) : 0;
    // just build the sibling nodes for the specific node
    if ($nodeChart.parent().is('td')) {
      var $parent = $nodeChart.closest('tr').prevAll('tr:last');
      $nodeChart.closest('tr').prevAll('tr:lt(2)').remove();
      var childCount = 0;
      buildChildNode.call($nodeChart.closest('.orgchart').parent(),$nodeChart.parent().closest('table'), nodeData, opts, function() {
        if (++childCount === newSiblingCount) {
          var $siblingTds = $nodeChart.parent().closest('table').children().children('tr:last').children('td');
          if (existingSibligCount > 1) {
            complementLine($siblingTds.eq(0).before($nodeChart.closest('td').siblings().andSelf().unwrap()), siblingCount, existingSibligCount);
            $siblingTds.addClass('hidden').find('.node').addClass('slide-left');
          } else {
            complementLine($siblingTds.eq(insertPostion).after($nodeChart.closest('td').unwrap()), siblingCount, 1);
            $siblingTds.not(':eq(' + insertPostion + 1 + ')').addClass('hidden')
              .slice(0, insertPostion).find('.node').addClass('slide-right')
              .end().end().slice(insertPostion).find('.node').addClass('slide-left');
          }
          callback();
        }
      });
    } else { // build the sibling nodes and parent node for the specific ndoe
      var nodeCount = 0;
      buildHierarchy($nodeChart.closest('.orgchart'), nodeData, 0, opts, function() {
        if (++nodeCount === siblingCount) {
          complementLine($nodeChart.next().children().children('tr:last')
            .children().eq(insertPostion).after($('<td colspan="2">')
            .append($nodeChart)), siblingCount, 1);
          $nodeChart.closest('tr').siblings().eq(0).addClass('hidden').find('.node').addClass('slide-down');
          $nodeChart.parent().siblings().addClass('hidden')
            .slice(0, insertPostion).find('.node').addClass('slide-right')
            .end().end().slice(insertPostion).find('.node').addClass('slide-left');
          callback();
        }
      });
    }
  }

  function addSiblings($node, data, opts) {
    buildSiblingNode.call($node.closest('.orgchart').parent(), $node.closest('table'), data, opts, function() {
      if (!$node.children('.leftEdge').length) {
        $node.children('.topEdge').after('<i class="edge horizontalEdge rightEdge fa"></i><i class="edge horizontalEdge leftEdge fa"></i>');
      }
      showSiblings($node);
    });
  }

  function removeNodes($node) {
    var $parent = $node.closest('table').parent();
    var $sibs = $parent.parent().siblings();
    if ($parent.is('td')) {
      if (getNodeState($node, 'siblings').exist) {
        $sibs.eq(2).children('.top:lt(2)').remove();
        $sibs.eq(':lt(2)').children().attr('colspan', $sibs.eq(2).children().length);
        $parent.remove();
      } else {
        $sibs.eq(0).children().attr('colspan', 2).end().siblings().remove();
      }
    } else {
      $parent.add($parent.siblings()).remove();
    }
  }

})(jQuery);
