"use strict"

var glopts = {
    sourceRepo: "https://github.com/dalena/majora",
    redirect: true,
    redir_seconds: 10,
    sound_count: 28,
    consoleImage: "https://static1.squarespace.com/static/523950d1e4b0eacf372043db/t/5583208ae4b0dd6ca1a4b945/1434656921780/"
}

function loggy(mode, str) {
    var color = "";
    var text = "";
    switch (mode) {
        case "anim":
            color = "green";
            text = "ANIM:";
            break;
        case "audio":
            color = "orange";
            text = "AUDIO:";
            break;
        case "app":
            color = "blue";
            text = "APP:";
            break;
        case "flow":
            color = "purple";
            text = "FLOW:";
            break;
        default:
            color = "red";
    }

    if (mode && str)
        console.style('<b="font-size:14px;color:red;">Majora |</b> ' + '<b="font-size:14px;color:' + color + ';">' + text + '</b> ' + str);
    else if (mode)
        console.style('<b="font-size:14px;color:red;">Majora |</b> ' + mode);
    else
        console.style('<img="background:url(' + glopts.consoleImage + ');width:250px;height:250px">');

}

function Utils() {
    this.getUrlParameter = function (sParam) {
        var sPageURL = decodeURIComponent(window.location.search.substring(1)),
            sURLVariables = sPageURL.split('&'),
            sParameterName,
            i;

        for (i = 0; i < sURLVariables.length; i++) {
            sParameterName = sURLVariables[i].split('=');

            if (sParameterName[0] === sParam) {
                return sParameterName[1] === undefined ? true : sParameterName[1];
            }
        }
    };

    this.handleVisibilityChange = function (callback) {
        // Set the name of the hidden property and the change event for visibility
        var hidden, visibilityChange;
        if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support 
            hidden = "hidden";
            visibilityChange = "visibilitychange";
        } else if (typeof document.msHidden !== "undefined") {
            hidden = "msHidden";
            visibilityChange = "msvisibilitychange";
        } else if (typeof document.webkitHidden !== "undefined") {
            hidden = "webkitHidden";
            visibilityChange = "webkitvisibilitychange";
        }

        // Warn if the browser doesn't support addEventListener or the Page Visibility API
        if (typeof document.addEventListener === "undefined" || typeof document.hidden === "undefined") {
            console.log("This demo requires a browser, such as Google Chrome or Firefox, that supports the Page Visibility API.");
        } else {
            // Handle page visibility change   
            document.addEventListener(visibilityChange, callback, false);
        }
    };
}

function Snd(type) {
    this.fftSize = 512;
    this.smoothingTimeConstant = 1.0;

    this.graph = false;

    this.bg = undefined;
    this.intro = undefined;
    this.outro = undefined;

    this.initSound = function (options) {
        var sound = new Howl({
            src: [
                './assets/audio/' + options.file + '.altconv.webm',
                './assets/audio/' + options.file + '.altconv.oga',
                './assets/audio/' + options.file + '.mp3'
            ],
            autoplay: options.autoplay,
            rate: options.rate,
            loop: options.loop,
            volume: options.volume
        });

        return sound;
    }

    this.introPlay = false;
    this.introEnd = false;
    this.introFade = false;
    this.outroPlay = false;
    this.outroEnd = false;
    this.outroFade = false;

    this.initBG = function () {
        var options = {
            file: "bg_theme",
            autoplay: false,
            rate: 0.5,
            loop: true,
            volume: 0
        }

        this.bg = this.initSound(options);
    };

    this.initIntro = function () {
        var options = {
            file: "intro",
            autoplay: false,
            rate: 0.9,
            loop: false,
            volume: 0
        }
        this.intro = this.initSound(options);
    };

    this.initOutro = function () {
        var idx = Math.floor(Math.random() * glopts.sound_count) + 1;
        var options = {
            file: "poem" + idx,
            autoplay: false,
            rate: 0.9,
            loop: false,
            volume: 0
        }

        this.outro = this.initSound(options);
    };

    this.analyser = undefined;
    this.buffer = undefined;
    this.isPrepared = false;

    this.prepare = function (_addGraph) {
        var analyser = Howler.ctx.createAnalyser();
        Howler.masterGain.connect(analyser);
        analyser.connect(Howler.ctx.destination);
        analyser.smoothingTimeConstant = this.smoothingTimeConstant;
        analyser.fftSize = this.fftSize;
        var buffer = new Uint8Array(this.fftSize);
        analyser.getByteTimeDomainData(buffer);
        this.analyser = analyser;
        this.buffer = buffer;
        this.isPrepared = true;
        loggy("audio", "Sound prepared.");
        this.graph && this.addGraph();
    }

    this.graphCanvas;
    this.graphContext;

    this.graphX = 0;

    this.addGraph = function () {
        var canvasID = 'snd-graph';
        $('body').append(`<canvas id="` + canvasID + `" width="1024" height="200" style="    position: absolute;top: 0;left: 0;"></canvas>`);
        var element = document.getElementById(canvasID);
        this.graphCanvas = element;
        this.graphContext = this.graphCanvas.getContext('2d');
    }

    this.drawGraph = function (a, b) {
        var t = this;
        t.graphX++;
        if (t.graphX > t.graphCanvas.width) {
            t.graphX = 0;
            t.graphContext.clearRect(0, 0, t.graphCanvas.width, t.graphCanvas.height)
        }
        t.graphContext.fillStyle = "red";
        t.graphContext.fillRect(t.graphX, a, 1, 1);
        t.graphContext.fillStyle = "yellow";
        t.graphContext.fillRect(t.graphX, b, 1, 1);
    }

    this.avgArr = [];
    this.avgLimit = 128 / 4;
    this.avgFilled = false;

    this.avgRMS = function (val, rmsArr, rmsArrLimit) {
        rmsArr.push(val);
        if (rmsArr.length == rmsArrLimit)
            loggy("audio", "Mean buffer filled.");
        if (rmsArr.length > rmsArrLimit) {
            rmsArr.shift();
            this.avgFilled = true;
        }

        var sum = 0;
        for (var i = 0; i < rmsArr.length; i++) {
            sum += rmsArr[i];
        }

        return sum / rmsArrLimit;
    }

    this.stats = {
        rms: 0,
        rmsSmooth: 0,
        rmsScaled: 0,
        rmsSmoothScaled: 0
    }

    this.rms = function (buffer) {
        var rms = 0;
        for (var i = 0; i < buffer.length; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms /= buffer.length;
        rms = Math.sqrt(rms);
        return rms
    }

    this.analyze = function () {
        var t = this;
        if (!t.isPrepared) {
            return;
        }

        this.analyser.getByteTimeDomainData(this.buffer);

        var rms = t.rms(t.buffer);
        var rmsSmooth = this.avgRMS(rms, this.avgArr, this.avgLimit);

        function scale(val) {
            var res = Math.abs(val - 127);
            // res = res * 100
            // res = Math.round(res) / 100
            return res;
        }

        var rmsScaled = scale(rms);
        var rmsSmoothScaled = scale(rmsSmooth);

        t.stats.rms = rms;
        t.stats.rmsSmooth = rmsSmooth;
        t.stats.rmsScaled = rmsScaled;
        t.stats.rmsSmoothScaled = rmsSmoothScaled;

        this.graph && this.drawGraph(30 - rmsScaled, 30 - rmsSmoothScaled * 2);
    }
}

// register the application module
b4w.register("Majora_main", function (exports, require) {
    // MODULES
    var m = {
        app: require("app"),
        main: require("main"),
        light: require("lights"),
        cfg: require("config"),
        data: require("data"),
        preloader: require("preloader"),
        ver: require("version"),
        gryo: require("gyroscope"),
        cont: require("container"),
        mouse: require("mouse"),
        cam: require("camera"),
        scenes: require("scenes"),
        anim: require("animation"),
        time: require("time"),
        ctl: require("controls"),
        trns: require("transform"),
    };

    var snd = new Snd();
    var utils = new Utils();

    // EXPORTS
    exports.mods = m;
    exports.init = init;
    exports.webglFailed = webglFailed
    exports.snd = snd;
    exports.utils = utils;

    // APP MODE
    var DEBUG = (m.ver.type() == "DEBUG");
    var VERBOSE = false;

    // DETECT ASSETS PATH
    var APP_ASSETS_PATH = m.cfg.get_assets_path("Majora");
    var APP_ASSETS_PATH = "./assets/";

    function init() {
        loggy();
        loggy("The curious shall be rewarded.");
        loggy("Source available at: " + glopts.sourceRepo);
        // if (flags.mobile) {
        //     loggy("app", "Mobile detected.");
        //     m.cfg.set("quality", m.cfg.P_LOW)
        //     loggy("app", "Quality set to low");
        // }

        if (true)
            m.app.init({
                canvas_container_id: "main_canvas_container",
                callback: initCallback,
                show_fps: VERBOSE,
                show_hud_debug_info: VERBOSE,
                min_capabilities: false,
                debug_loading: VERBOSE,
                console_verbose: VERBOSE,
                autoresize: true,
                report_init_failure: false,
                pause_invisible: true
                // assets_gzip_available: true
            });
    }

    function initCallback(canvas_elem, success) {
        if (!success) {
            webglFailed();
            return;
        }

        $('#preloader_cont').css('visibility', 'visible');
        $('#preloader_cont').removeClass('opacity-zero');
        $('#preloader_cont').addClass('opacity-full');

        // ignore right-click on the canvas element
        canvas_elem.oncontextmenu = function (e) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        };

        load();

        // Start BACKGROUND theme sound
        audioBGStart();
    }

    function load() {
        m.data.load(APP_ASSETS_PATH + "Majora.json", loadCallback, preloaderCallback);
    }

    function preloaderCallback(percentage) {
        $('#prelod_dynamic_path').css('width', percentage + "%");
        if (percentage == 100) {
            $('#preloader_cont').removeClass('opacity-full');
            $('#preloader_cont').addClass('opacity-zero');
            setTimeout(function () {
                $('#preloader_cont').remove();
                $('#webgl-fail').remove();
            }, 500)
        }
    }

    var energy

    function renderCallback() {
        snd.rmsArrLimit = 64;
        snd.analyze();

        energy = snd.stats.rmsSmoothScaled;

        if (snd.avgFilled && !snd.introEnd && energy > 0.7)
            m.light.set_light_energy(objs.light_point, energy * 2);
    }

    var objs = {
        cam: undefined,
        light_point: undefined,
        light_point_back: undefined,
        light_point_back_1: undefined,
        light_point_back_2: undefined,
        light_point_back_3: undefined,
        light_point_back_4: undefined
    };
    exports.objs = objs;

    var timeouts = {

    };
    exports.timeouts = timeouts;

    var flags = {
        playing: "init",
        mobile: m.main.detect_mobile(),
        allowToggle: false,
        godRays: true,
        isPageVisible: true,
    }
    exports.flags = flags;

    function loadCallback(data_id, success) {
        if (!success) {
            loggy("app", "Loading failed.");
            return;
        }

        utils.handleVisibilityChange(function () {
            flags.isPageVisible = !m.main.is_paused();

            if (flags.isPageVisible && typeof snd.bg == 'object') {
                if (snd.bg.playing)
                    snd.bg.play();
            }
            if (flags.isPageVisible && typeof snd.intro == 'object') {
                if (snd.introPlay && !snd.introEnd)
                    snd.intro.play();
            }
            if (flags.isPageVisible && typeof snd.outro == 'object') {
                if (snd.outroPlay && !snd.outroEnd)
                    snd.outro.play();
            }
            if (!flags.isPageVisible && typeof snd.bg == 'object') {
                snd.bg.pause();
            }
            if (!flags.isPageVisible && typeof snd.intro == 'object') {
                if (snd.introPlay && !snd.introEnd)
                    snd.intro.pause();
            }
            if (!flags.isPageVisible && typeof snd.outro == 'object') {
                if (snd.outroPlay && !snd.outroEnd)
                    snd.outro.pause();
            }

            document.title = flags.isPageVisible ? "Majora" : "❚❚ Majora";
        })


        objs.cam = m.scenes.get_object_by_name("camera");
        objs.light_point = m.scenes.get_object_by_name("light_point");
        objs.light_point_back = m.scenes.get_object_by_name("light_point_back");
        objs.light_point_back_1 = m.scenes.get_object_by_name("light_point_back.001");
        objs.light_point_back_2 = m.scenes.get_object_by_name("light_point_back.002");
        objs.light_point_back_3 = m.scenes.get_object_by_name("light_point_back.003");
        objs.light_point_back_4 = m.scenes.get_object_by_name("light_point_back.004");
        // m.anim.apply(objs.light_point, "on", 0);
        // m.anim.play(objs.light_point, null, 0);

        var canvas_elem = m.cont.get_canvas();
        if (!flags.mobile) {
            registerMouse();

            canvas_elem.addEventListener("mouseup", function (e) {
                m.mouse.request_pointerlock(canvas_elem, null, null, null, null, rot_cb);
            }, false);

            m.mouse.set_plock_smooth_factor(5);
        } else {
            canvas_elem.addEventListener("click", toggleScenes, false);
        }

        // camera = m.scene.get_active_camera();

        m.main.set_render_callback(renderCallback);

        m.app.enable_camera_controls();
        m.gryo.enable_camera_rotation();

        $("#welcome-container").show();
        $("#welcome-container").removeClass('opacity-zero');
        $("#welcome-container").addClass('opacity-full');
    }

    function begin() {
        if(!flags.mobile){
            var canvas_elem = m.cont.get_canvas();
            m.mouse.request_pointerlock(canvas_elem, null, null, null, null, rot_cb);
        }

        $("#welcome-container").removeClass('opacity-full');
        $("#welcome-container").addClass('opacity-zero');

        // If success for load, play the INTRO sound
        m.time.set_timeout(function () {
            $("#welcome-container").remove();
            animIntroFadeIn();
            m.cam.rotate_camera(majora.objs.cam, 0, 0, true)
        }, 2000)

        timeouts.loadCallback = m.time.set_timeout(function () {
            audioIntroStart();
        }, 6000);
    }

    exports.begin = begin;

    var camera_smooth_fact = 2;
    var camera_rot_fact = 5;

    function rot_cb(rot_x, rot_y) {
        m.cam.rotate_camera(objs.cam, rot_x * camera_rot_fact, rot_y * camera_rot_fact);
    }

    function registerMouse() {
        var clickSensor = m.ctl.create_mouse_click_sensor();

        function logic(triggers) {
            if (triggers[0])
                return 1;
            else
                return 0;
        }

        function cb(obj, id, pulse, param) {
            // console.log(pulse)
            if (pulse == 1) {
                toggleScenes()
            }
            return;
        };

        m.ctl.create_sensor_manifold(null,
            "mouse",
            m.ctl.CT_TRIGGER, [clickSensor],
            logic,
            cb,
        );

        loggy("app", "Mouse registered.")
    }

    function toggleScenes() {
        animOutroFadeIn();
        if (flags.allowToggle) {
            loggy("app", "Scene toggled.")
            if (flags.playing == "outro")
                animIntroFadeIn();
            else if (flags.playing == "intro")
                animOutroFadeIn();
        }
    }
    exports.toggleScenes = toggleScenes

    function audioBGStart() {
        snd.initBG();
        snd.bg.play();
        snd.bg.fade(0, 0.3, 6000);
    }

    function audioIntroStart() {
        snd.initIntro();
        snd.intro.play();
        snd.intro.once('play', function () {
            loggy("audio", "Intro played.");
            snd.introPlay = true;
            snd.prepare()
        });
        snd.intro.fade(0, 0.5, 6000);
        snd.intro.once('fade', function () {
            loggy("audio", "Intro fade-in completed.");
            snd.introFade = true;
        });
        snd.intro.once('end', function () {
            loggy("audio", "Intro ended.");
            snd.introEnd = true;
            audioIntroEnd();
        });
    }

    function audioOutroStart() {
        snd.initOutro();
        snd.outro.play();
        snd.outro.once('play', function () {
            loggy("audio", "Outro played.");
            snd.outroPlay = true;
        });
        snd.outro.fade(0, 0.5, 6000);
        snd.outro.once('fade', function () {
            loggy("audio", "Outro fade-in completed.");
            snd.introFade = true;
        });
        snd.outro.once('end', function () {
            loggy("audio", "Outro ended.");
            snd.outroEnd = true;
            flags.allowToggle = true
            loggy("app", "Toggle enabled");

            $('#footer').removeClass('opacity-zero');
            $('#footer').addClass('opacity-full');
        });
    }

    function audioIntroEnd() {
        animIntroFadeOut()
        m.time.set_timeout(function () {
            formTrigger("show");
        }, 6000)
    }

    function formSubmitted() {
        timeouts.audioIntroEnd = m.time.set_timeout(function () {
            $('#form-container').remove();

            animOutroFadeIn();

            timeouts.audioIntroEnd2 = m.time.set_timeout(function () {
                audioOutroStart();
            }, 6000);

        }, 6000);
    }

    function setCameraLimits(cam, opts) {
        if (opts != null) {
            m.cam.target_set_horizontal_limits(cam, {
                left: opts.left,
                right: opts.right
            });
            m.cam.target_set_vertical_limits(cam, {
                up: opts.up,
                down: opts.down
            });
        } else {
            m.cam.target_set_horizontal_limits(cam, null);
            m.cam.target_set_vertical_limits(cam, null);
        }
    }

    function setDOF(bool) {
        m.scenes.set_dof_params({
            dof_on: bool
        });
    }

    function setGodRays(opts) {
        if (flags.mobile)
            return

        m.time.animate(opts.from, opts.to, opts.duration, function (v) {
            m.scenes.set_god_rays_params({
                god_rays_max_ray_length: opts.maxLength == "animated" ? v : opts.maxLength,
                god_rays_intensity: opts.intensity == "animated" ? (v * flags.godRays) : opts.intensity,
                god_rays_steps: opts.steps == "animated" ? v : opts.steps
            });
        })
    }

    function setLights(opts) {
        m.time.animate(opts.from, opts.to, opts.duration, function (v) {
            m.light.set_light_energy(objs.light_point, v);
            if (opts.both) {
                m.light.set_light_energy(objs.light_point_back, v);
                m.light.set_light_energy(objs.light_point_back_1, v);
                m.light.set_light_energy(objs.light_point_back_2, v);
                m.light.set_light_energy(objs.light_point_back_3, v);
                m.light.set_light_energy(objs.light_point_back_4, v);
            } else {
                m.light.set_light_energy(objs.light_point_back, 0);
                m.light.set_light_energy(objs.light_point_back_1, 0);
                m.light.set_light_energy(objs.light_point_back_2, 0);
                m.light.set_light_energy(objs.light_point_back_3, 0);
                m.light.set_light_energy(objs.light_point_back_4, 0);
            }
        })
    }

    function toggleObjects(flag) {
        var func1 = m.scenes.show_object;
        var func2 = m.scenes.hide_object;
        if (flag == "crystal") {
            func1 = m.scenes.hide_object;
            func2 = m.scenes.show_object;
        }
        func1(m.scenes.get_object_by_name("hide"))
        func1(m.scenes.get_object_by_name("eye_left"))
        func1(m.scenes.get_object_by_name("eye_right"))
        func2(m.scenes.get_object_by_name("crystal"))
    }
    exports.toggleObjects = toggleObjects

    function animIntroFadeIn(callback) {
        loggy("anim", "Intro fade-in started.");

        
        m.time.clear_timeout(timeouts.animOutroFadeIn);

        flags.playing = "intro";
        toggleObjects("head");


        m.cam.rotate_camera(majora.objs.cam, 0, 0, true)

        setDOF(true);

        setCameraLimits(objs.cam, {
            left: -45,
            right: 45,
            up: -Math.PI / 4,
            down: Math.PI / 4
        })


        setLights({
            from: 0,
            to: 1,
            duration: 6000,
        })

        flags.godRays = true;
        setGodRays({
            from: 0,
            to: 1,
            duration: 6000,
            maxLength: 2,
            intensity: "animated",
            steps: 10
        })

        timeouts.animIntroFadeIn = m.time.set_timeout(function () {
            loggy("anim", "Intro fade-in completed.");
            if (callback != null)
                callback();
        }, 6000);

    }
    exports.animIntroFadeIn = animIntroFadeIn

    function animIntroFadeOut() {
        loggy("anim", "Intro fade-out started.")
        setLights({
            from: 1.4,
            to: 0,
            duration: 6000,
        })

        setGodRays({
            from: 1,
            to: 0,
            duration: 6000,
            maxLength: 2,
            intensity: "animated",
            steps: 10
        })

        timeouts.animIntroFadeOut = m.time.set_timeout(function () {
            loggy("anim", "Intro fade-out completed.")
        }, 6000);
    }
    exports.animIntroFadeOut = animIntroFadeOut

    function animOutroFadeIn(callback) {
        m.time.clear_timeout(timeouts.animIntroFadeIn);
        loggy("anim", "Outro fade-in started.");
        flags.playing = "outro";
        toggleObjects("crystal");

        setCameraLimits(objs.cam, null);
        setDOF(false);

        setLights({
            both: true,
            from: 0,
            to: 1.4,
            duration: 6000,
        })

        flags.godRays = false;

        timeouts.animOutroFadeIn = m.time.set_timeout(function () {
            loggy("anim", "Outro fade-in completed.");
        }, 6000);
    }
    exports.animOutroFadeIn = animOutroFadeIn

    function webglFailed() {
        loggy("app", "WebGL initialization failed.");

        $('#main_canvas_container').remove();
        $('#webgl-fail').removeClass('opacity-zero');
        $('#webgl-fail').addClass('opacity-full');


        var seconds_span = $('#redir-seconds');

        function incrementSeconds() {
            glopts.redir_seconds -= 1;
            seconds_span.text(glopts.redir_seconds)
            glopts.redir_seconds == 0 && glopts.redirect && (document.location.href = "http://sevdaliza.com");
        }

        var cancel = setInterval(incrementSeconds, 1000);
    }

    function formTrigger(flag) {
        if (flag == "show") {
            loggy("app", "Form displayed.");
            document.exitPointerLock();
            $('#form-container').show();
            $('#form-container').removeClass('opacity-zero');
            $('#form-container').addClass('opacity-full');
        } else if (flag == "hide") {
            loggy("app", "Form hide.");
            $('#form-container').addClass('opacity-zero');
            $('#form-container').removeClass('opacity-full');
            formSubmitted();
        }
    }
    exports.formTrigger = formTrigger

});

var majora = b4w.require("Majora_main");
majora.init();

$(document).ready(function () {
    $.getJSON("./assets/country-calling-codes.min.json", function (obj) {
        $.each(obj, function (key, value) {
            var text = value.name + ' (+' + value.callingCode + ')'
            $("#countries").append('<option value="' + text + '">' + text + "</option>");
        });
    });

    var forms = document.getElementsByClassName('needs-validation');
    // Loop over them and prevent submission
    var validation = Array.prototype.filter.call(forms, function (form) {
        form.addEventListener('submit', function (event) {
            if (form.checkValidity() === false) {
                event.preventDefault();
                event.stopPropagation();
            } else {
                var url = $(".needs-validation").prop('action'); // the script where you handle the form input.
                $.ajax({
                    type: "GET",
                    url: url,
                    data: $(".needs-validation").serialize(), // serializes the form's elements.
                    cache: false,
                    dataType: 'jsonp',
                    contentType: "application/json; charset=utf-8",
                    error: function (err) {
                        loggy("app", "Form submission error.");
                    },
                    success: function (data) {
                        if (data.result != "success") {
                            loggy("app", "Form submission failed.");
                            $("#form-message").text(data.msg);
                            $("#form-message").css('color', '#dc3545');
                            // console.log(data);
                        } else {
                            $("#form-message").text(data.msg);
                            $("#form-message").css('color', '#28a745');
                            loggy("app", "Form submission successful.");
                            majora.formTrigger("hide");
                            //formSuccess();
                        }
                    }
                });

                event.preventDefault(); // avoid to execute the actual submit of the form.
            }
            form.classList.add('was-validated');
        }, false);
    });


    $('#form-container').hide();
});