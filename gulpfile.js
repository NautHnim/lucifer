/*jslint node: true */
"use strict";

var $           = require('gulp-load-plugins')();
var argv        = require('yargs').argv;
var gulp        = require('gulp');
var browserSync = require('browser-sync').create();
var htmlInjector = require( 'bs-html-injector' );
var snipInjector = require( 'bs-snippet-injector' );
var glob         = require( 'glob' );
var merge       = require('merge-stream');
var sequence    = require('run-sequence');
var colors      = require('colors');
var dateFormat  = require('dateformat');
var del         = require('del');

// Enter URL of your local server here
// Example: 'http://localwebsite.dev'
var proxy = 'http://lucifer.local';

var files            = glob( './src/*', {sync: true} );
var theme            = files[0].replace( './src/', '' );

// Check for --production flag
var isProduction = !!(argv.production);

// Browsers to target when prefixing CSS.
var COMPATIBILITY = [
  'last 2 versions',
  'ie >= 9',
  'Android >= 2.3'
];

// File paths to various assets are defined here.
var PATHS = {
  sass: [
    'src/' + theme  + '/assets/components/foundation-sites/scss',
    'src/' + theme  + '/assets/components/motion-ui/src',
    'src/' + theme  + '/assets/components/fontawesome/scss',
  ],
  javascript: [
    'src/' + theme  + '/assets/components/what-input/what-input.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.core.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.util.*.js',

    // Paths to individual JS components defined below
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.abide.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.accordion.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.accordionMenu.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.drilldown.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.dropdown.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.dropdownMenu.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.equalizer.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.interchange.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.magellan.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.offcanvas.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.orbit.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.responsiveMenu.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.responsiveToggle.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.reveal.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.slider.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.sticky.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.tabs.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.toggler.js',
    'src/' + theme  + '/assets/components/foundation-sites/js/foundation.tooltip.js',

    // Motion UI
    'src/' + theme  + '/assets/components/motion-ui/motion-ui.js',

    // Include your own custom scripts (located in the custom folder)
    'src/' + theme  + '/assets/javascript/custom/*.js',
  ],
  phpcs: [
    '**/*.php',
    '!wpcs',
    '!wpcs/**',
  ],
  pkg: [
    '**/*',
    '!**/node_modules/**',
    '!**/components/**',
    '!**/scss/**',
    '!**/bower.json',
    '!**/gulpfile.js',
    '!**/package.json',
    '!**/composer.json',
    '!**/composer.lock',
    '!**/ruleset.xml',
    '!**/packaged/*',
  ]
};

// Browsersync task
gulp.task('browser-sync', ['build'], function() {
  var files = [
            '**/*.php',
            'src/' + theme  + '/assets/images/**/*.{png,jpg,gif}',
          ];

  browserSync.use( snipInjector, {
    file: 'src/' + theme  + '/footer.php'
  } );

  browserSync.init(files, {
    notify: {
      styles: {
        top: '32px',
      }
    }
  });
});

// Compile Sass into CSS
// In production, the CSS is compressed
gulp.task('sass', function() {
  // Minify CSS if run with --production flag
  var minifycss = $.if(isProduction, $.minifyCss());

  return gulp.src('src/' + theme  + '/assets/scss/foundation.scss')
    .pipe($.plumber({errorHandler: $.notify.onError( "<%= error.message %>" )}))
    .pipe($.sourcemaps.init())
    .pipe($.sass({
      includePaths: PATHS.sass
    }))
    .on('error', $.notify.onError({
        message: "<%= error.message %>",
        title: "Sass Error"
    }))
    .pipe($.autoprefixer({
      browsers: COMPATIBILITY
    }))
    .pipe(minifycss)
    .pipe($.if(!isProduction, $.sourcemaps.write('.')))
    .pipe(gulp.dest('src/' + theme  + '/assets/stylesheets'))
    .pipe(browserSync.stream({match: '**/*.css'}));
});

// Lint all JS files in custom directory
gulp.task('lint', function() {
  return gulp.src('src/' + theme  + '/assets/javascript/custom/*.js')
    .pipe($.plumber({errorHandler: $.notify.onError( "<%= error.message %>" )}))
    .pipe($.jshint())
    .pipe($.notify(function (file) {
      if (file.jshint.success) {
        return false;
      }

      var errors = file.jshint.results.map(function (data) {
        if (data.error) {
          return "(" + data.error.line + ':' + data.error.character + ') ' + data.error.reason;
        }
      }).join("\n");
      return file.relative + " (" + file.jshint.results.length + " errors)\n" + errors;
    }));
});

// Combine JavaScript into one file
// In production, the file is minified
gulp.task('javascript', function() {
  var uglify = $.uglify()
    .on('error', $.notify.onError({
      message: "<%= error.message %>",
      title: "Uglify JS Error"
    }));

  return gulp.src(PATHS.javascript)
    .pipe($.plumber( {errorHandler: $.notify.onError( "<%= error.message %>" )} ) )
    .pipe($.sourcemaps.init())
    .pipe($.babel())
    .pipe($.concat('foundation.js', {
      newLine:'\n;'
    }))
    .pipe($.if(isProduction, uglify))
    .pipe($.if(!isProduction, $.sourcemaps.write()))
    .pipe(gulp.dest('src/' + theme  + '/assets/javascript'))
    .pipe(browserSync.stream());
});

// Copy task
gulp.task('copy', function() {
  // Motion UI
  var motionUi = gulp.src('src/' + theme  + '/assets/components/motion-ui/**/*.*')
    .pipe($.plumber({errorHandler: $.notify.onError( "<%= error.message %>" )}))
    .pipe($.flatten())
    .pipe(gulp.dest('src/' + theme  + '/assets/javascript/vendor/motion-ui'));

  // What Input
  var whatInput = gulp.src('src/' + theme  + '/assets/components/what-input/**/*.*')
      .pipe($.plumber({errorHandler: $.notify.onError( "<%= error.message %>" )}))
      .pipe($.flatten())
      .pipe(gulp.dest('src/' + theme  + '/assets/javascript/vendor/what-input'));

  // Font Awesome
  var fontAwesome = gulp.src('src/' + theme  + '/assets/components/fontawesome/fonts/**/*.*')
      .pipe(gulp.dest('src/' + theme  + '/assets/fonts'));

  return merge(motionUi, whatInput, fontAwesome);
});

// Package task
gulp.task('package', ['build'], function() {
  var fs = require('fs');
  var time = dateFormat(new Date(), "yyyy-mm-dd_HH-MM");
  var pkg = JSON.parse(fs.readFileSync('./package.json'));
  var title = pkg.name + '_' + time + '.zip';

  return gulp.src(PATHS.pkg)
    .pipe($.plumber({errorHandler: $.notify.onError( "<%= error.message %>" )}))
    .pipe($.zip(title))
    .pipe(gulp.dest('packaged'));
});

// Build task
// Runs copy then runs sass & javascript in parallel
gulp.task('build', ['clean'], function(done) {
  sequence('copy',
          ['sass', 'javascript', 'lint'],
          done);
});

// PHP Code Sniffer task
gulp.task('phpcs', function() {
  return gulp.src(PATHS.phpcs)
    .pipe($.plumber({errorHandler: $.notify.onError( "<%= error.message %>" )}))
    .pipe($.phpcs({
      bin: 'wpcs/vendor/bin/phpcs',
      standard: './ruleset.xml',
      showSniffCode: true,
    }))
    .pipe($.phpcs.reporter('log'));
});

// PHP Code Beautifier task
gulp.task('phpcbf', function () {
  return gulp.src(PATHS.phpcs)
  .pipe($.plumber({errorHandler: $.notify.onError( "<%= error.message %>" )}))
  .pipe($.phpcbf({
    bin: 'wpcs/vendor/bin/phpcbf',
    standard: './ruleset.xml',
    warningSeverity: 0
  }))
  .on('error', $.util.log)
  .pipe(gulp.dest('.'));
});

// Clean task
gulp.task('clean', function(done) {
  sequence(['clean:javascript', 'clean:css'],
            done);
});

// Clean JS
gulp.task('clean:javascript', function() {
  return del([
    'src/' + theme  + '/assets/javascript/foundation.js'
    ]);
});

// Clean CSS
gulp.task('clean:css', function() {
  return del([
      'src/' + theme  + '/assets/stylesheets/foundation.css',
      'src/' + theme  + '/assets/stylesheets/foundation.css.map'
    ]);
});

// Default gulp task
// Run build task and watch for file changes
gulp.task('default', ['build', 'browser-sync'], function() {
  // Log file changes to console
  function logFileChange(event) {
    var fileName = require('path').relative(__dirname, event.path);
    console.log('[' + 'WATCH'.green + '] ' + fileName.magenta + ' was ' + event.type + ', running tasks...');
  }

  // Sass Watch
  gulp.watch(['src/' + theme  + '/assets/scss/**/*.scss'], ['clean:css', 'sass'])
    .on('change', function(event) {
      logFileChange(event);
    });

  // JS Watch
  gulp.watch(['src/' + theme  + '/assets/javascript/custom/**/*.js'], ['clean:javascript', 'javascript', 'lint'])
    .on('change', function(event) {
      logFileChange(event);
    });
});
