#!/usr/bin/env node

var _        = require('underscore');
var inquirer = require('inquirer');
var open     = require('open');
var colors   = require('colors');
var path     = require('path');

var storyRelPath = process.argv.length > 2 ? process.argv[2] : 'story.js';

const BLOCK_LEVEL = ['ADDRESS', 'BLOCKQUOTE', 'CENTER', 'DIR', 'DIV', 'DL',
  'FIELDSET', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'ISINDEX', 'MENU',
  'NOFRAMES', 'NOSCRIPT', 'OL', 'P', 'PRE', 'TABLE', 'UL'];

var jQueryMixins = {
  isSectionAction: function() {
    return this.hasClass('link-section');
  },
  isPassageAction: function() {
    return this.hasClass('link-passage');
  },
  actionType: function() {
    if (this.isSectionAction()) {
      return 'section';
    } else if (this.isPassageAction()) {
      return 'passage';
    }
  },
  getAction: function() {
    return this.data(this.actionType());
  }
};

global.alert = function(str) {
  var width = str.length + 5;
  var border = Array(width).join('-');

  puts(' ',   border,   ' \n');
  puts(' | ', str.grey, ' | \n');
  puts(' ',   border,   ' \n');
};

function isBlockLevel(el) {
  return BLOCK_LEVEL.indexOf(el.tagName) !== -1;
}

function isTextNode(el) {
  return el.nodeType === 3 && el.nodeValue;
}

function removeChoice(choices, value) {
  return _.reject(choices, function(item) {
    return item.value === value;
  });
}

function puts() {
  var out = Array.prototype.slice.call(arguments).join(' ');
  process.stdout.write(out);
}

function putsLine() {
  puts.apply(null, arguments);
  puts('\n');
}

function newline() {
  puts('\n');
}

function newlines(n) {
  while (n--) {
    newline();
  }
}

function crawl(node, callback) {
  if (!node) {
    return;
  }

  var skip = callback(node);

  var nextNode = null;

  if (!skip && node.hasChildNodes()) {
    nextNode = node.firstChild;
  } else if (node.nextSibling) {
    nextNode = node.nextSibling;
  } else {
    var nextParent = node.parentNode;
    while (nextParent) {
      var nextUncle = nextParent.nextSibling;

      if (!nextUncle) {
        nextParent = nextParent.parentNode;
      } else {
        nextNode = nextUncle;
        break;
      }
    }
  }

  var lastNode = crawl(nextNode, callback);

  return lastNode || node;
}

require('jsdom').env('', function (err, window) {
  if (err) return;

  global.window = window;
  global.$ = global.jQuery = require('jquery');
  _.extend(jQuery.fn, jQueryMixins);

  var storyAbsPath = path.resolve(process.cwd(), storyRelPath);
  try {
    require(storyAbsPath);
  } catch (e) {
    putsLine('Unable to find story file at path', storyAbsPath);
    return 1;
  }

  var main = $('<div/>');

  main.squiffy();

  var pointer = main.get(0);

  var continueStory = function(choices) {
    choices || (choices = [])

    var nextPointer = crawl(pointer, function(el) {
      if (el === pointer) {
        return;
      }

      if (el.tagName === 'A') {
        el = $(el);
        var text = el.text();

        choices.push({ name: text, value: el });

        puts(text.underline.cyan);

        return true; // Return true to skip crawling all children
      } else if (isTextNode(el)) {
        var n = isBlockLevel(el) ? 1 : 0;
        newlines(n);
        puts(el.nodeValue);
        newlines(n);
      }
    });

    pointer = nextPointer;

    newlines(2);
    if (choices.length === 0) {
      puts('~ fin ~');
      newlines(2);
      return;
    }

    inquirer.prompt({
      type: 'list',
      name: 'lastAnswer',
      message: 'Select an option: ',
      choices: choices
    }).then(function(answers) {
      var clicked = answers.lastAnswer;

      clicked.trigger('click');

      if (clicked.isPassageAction()) {
        choices = removeChoice(choices, clicked);
      } else if (clicked.isSectionAction()) {
        choices = null;
      } else {
        open(clicked.attr('href'));
      }

      continueStory(choices);
    });
  }

  continueStory();
});
