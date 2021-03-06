/* jshint node: true */
/* jshint browser: true */
/* globals $:false */
"use strict";

// import Materialize from "materialize-css";
// import qrcode from "qrcode";

const axios = require("axios");
const swal = require("sweetalert2");

const gui = require("nw.gui");
const path = require("path");
var win = gui.Window.get();
var confFile = "settings.json";
var consoleLog = path.join(gui.__dirname, "console.log");
var colorTheme = "#009688"; // teal

var toastTime = 3000;
var toastInfo = "rounded grey";
var toastSuccess = "rounded green";
var toastError = "rounded red";

function addTokenHeader() {
    axios.defaults.headers.common.Authorization = global.token;
}

// I18N
function loadLocale(locale) {
    const fs = require("fs");
    var filePath = path.join(".", "app", "locales", locale + ".json");

    if (fs.existsSync(filePath)) {
        var data = fs.readFileSync(filePath, "utf8");
        global.strings = JSON.parse(data);
    }
}

function _(txt, data = {}) {
    const mustache = require("mustache");

    if (
        typeof global.strings !== "undefined" &&
        global.strings.hasOwnProperty(txt)
    ) {
        return mustache.render(global.strings[txt], data);
    } else {
        return mustache.render(txt, data);
    }
}

function showError(text) {
    swal({
        title: "Error",
        text,
        type: "error",
        confirmButtonColor: colorTheme,
        showCancelButton: false
    });
}

function getServerVersion() {
    var url = "/api/v1/public/server/info/";

    axios
        .head(url)
        .then(function(response) {
            addTokenHeader();
            axios
                .post(url, {})
                .then(function(response) {
                    global.serverVersion = parseFloat(response.data.version);
                })
                .catch(function(error) {
                    global.serverVersion = 0;
                    showError(_("Migasfree server not compatible"));
                });
        })
        .catch(function(error) {
            global.serverVersion = 0;
            showError(_("migasfree-server version 4.17 is required"));
        });
}

function getOS() {
    var osName = "Unknown";

    if (navigator.appVersion.indexOf("Win") !== -1) {
        osName = "Windows";
    }
    if (navigator.appVersion.indexOf("Mac") !== -1) {
        osName = "MacOS";
    }
    if (navigator.appVersion.indexOf("X11") !== -1) {
        osName = "UNIX";
    }
    if (navigator.appVersion.indexOf("Linux") !== -1) {
        osName = "Linux";
    }

    return osName;
}

function spinner(id) {
    const fs = require("fs");
    $("#" + id).html(fs.readFileSync("templates/spinner.html", "utf8"));
}

function escapeRegExp(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function replaceAll(str, find, replace) {
    var exp = escapeRegExp(find);
    var re = new RegExp(exp, "g");

    return str.replace(re, replace);
}

function replaceColors(txt) {
    txt = replaceAll(txt, "\u001b[92m", "<span class='console-section'>");
    txt = replaceAll(txt, "\u001b[93m", "<span class='console-warning'>");
    txt = replaceAll(txt, "\u001b[91m", "<span class='console-error'>");
    txt = replaceAll(txt, "\u001b[32m", "<span class='console-info'>");
    txt = replaceAll(txt, "\u001b[0m", "</span>");
    txt = txt.replace(/(?:\r\n|\r|\n)/g, "<br />");

    return txt;
}

function tooltip(id, text) {
    var anchor = $(id);

    anchor.attr("data-tooltip", text);
    anchor.attr("delay", 100);
    if (id === "#machine") {
        anchor.attr("data-position", "bottom");
    } else {
        anchor.attr("data-position", "left");
    }
    anchor.tooltip();
}

function slugify(value) {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]+/g, "")
        .replace(/\-\-+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");
}

function saveTerminal() {
    const fs = require("fs");

    fs.writeFile(consoleLog, JSON.stringify(global.terminal), function(err) {
        if (err) {
            throw err;
        }
    });
}

function exit() {
    win.window.close();
}

(function() {
    document.onkeydown = function(e) {
        if (e.keyCode === 116) {
            // F5
            e.preventDefault();
            location.reload();
            return false;
        }
    };
})();

gui.Window.get().on("close", function() {
    if (global.running) {
        Materialize.toast(
            "<i class='material-icons'>warning</i>" +
                _("please wait, other process is running!!!"),
            toastTime,
            toastError
        );
    } else {
        exit();
        gui.App.quit();
    }
});

Array.prototype.diff = function(a) {
    return this.filter(function(i) {
        return a.indexOf(i) < 0;
    });
};

function labelDone() {
    if (typeof global.label !== "undefined") {
        $("#machine").html(
            "<a class='js-external-link' href='http://{{server}}/admin/server/computer/{{cid}}/change/'>" +
                global.label.name +
                "</a>"
        );
        tooltip("#machine", _("View computer in migasfree server"));

        var typeNumber = 4;
        var errorCorrectionLevel = "L";
        var qr = qrcode(typeNumber, errorCorrectionLevel);

        qr.addData(
            '{"model":"Computer","id":' +
                global.label.id +
                ',"server":"' +
                global.label.server +
                '"}'
        );
        qr.make();

        global.qr = qr;
    }
}

function getToken(username = "migasfree-play", password = "migasfree-play") {
    axios
        .post("/token-auth/", { username, password })
        .then(function(response) {
            const fs = require("fs");
            global.token = "token " + response.data.token;
            fs.writeFileSync("token", response.data.token);
        })
        .catch(function(error) {
            swal({
                title: "Server: " + global.server,
                text: "Token: " + error.response.data, // FIXME
                type: "error",
                confirmButtonColor: colorTheme,
                showCancelButton: false
            }).then(
                function() {
                    gui.App.quit();
                },
                function(dismiss) {
                    // dismiss can be 'overlay', 'cancel', 'close', 'esc', 'timer'
                    if (dismiss === "cancel") {
                        // nothing
                    }
                }
            );
        });
}

function getAttributeCID() {
    if (typeof global.label !== "undefined") {
        addTokenHeader();
        axios
            .get(global.baseApi + "/attributes/", {
                property_att__prefix: "CID",
                value: global.cid
            })
            .then(function(response) {
                if (response.data.count === 1) {
                    global.attCid = response.data.results[0].id;
                }
            })
            .catch(function(error) {
                showError(error.message);
            });
    }
}

function saveSettings(settings) {
    const fs = require("fs");
    var filePath = path.join(confFile);

    fs.writeFileSync(filePath, JSON.stringify(settings));
}

function readSettings() {
    const fs = require("fs");
    var filePath = path.join(confFile);

    if (fs.existsSync(filePath)) {
        var data = fs.readFileSync(filePath, "utf8");

        global.settings = JSON.parse(data);
        if (!global.settings.hasOwnProperty("showAppsMenu")) {
            global.settings.showAppsMenu = true;
            saveSettings(global.settings);
        }
        if (!global.settings.hasOwnProperty("showDevicesMenu")) {
            global.settings.showDevicesMenu = true;
            saveSettings(global.settings);
        }
        if (!global.settings.hasOwnProperty("showDetailsMenu")) {
            global.settings.showDetailsMenu = true;
            saveSettings(global.settings);
        }
        if (!global.settings.hasOwnProperty("showSettingsMenu")) {
            global.settings.showSettingsMenu = true;
            saveSettings(global.settings);
        }
        if (!global.settings.hasOwnProperty("showInfoMenu")) {
            global.settings.showInfoMenu = true;
            saveSettings(global.settings);
        }
        if (!global.settings.hasOwnProperty("showHelpMenu")) {
            global.settings.showHelpMenu = true;
            saveSettings(global.settings);
        }
    } else {
        global.settings = {};
        global.settings.language = "es";
        global.settings.theme = "dark";
        global.settings.showSyncDetails = false;
        global.settings.showAppsMenu = true;
        global.settings.showDevicesMenu = true;
        global.settings.showDetailsMenu = true;
        global.settings.showSettingsMenu = true;
        global.settings.showInfoMenu = true;
        global.settings.showHelpMenu = true;

        saveSettings(global.settings);
    }
    loadLocale(global.settings.language);
}

function getPkgNames() {
    var execSync = require("child_process").execSync;
    var packages = execSync(
        "python -c \"from __future__ import print_function; from migasfree_client.client import MigasFreeClient; print(MigasFreeClient().pms.available_packages(), end='')\""
    ).toString();
    packages = replaceAll(packages, "'", '"');

    return JSON.parse(packages);
}

function execDir(directory) {
    const fs = require("fs");
    const execSync = require("child_process").execSync;

    try {
        fs.accessSync(directory);
    } catch (e) {
        return;
    }

    var files = fs.readdirSync(directory);
    for (var i in files) {
        global.TERMINAL.add(execSync(path.join(directory, files[i])));
    }
}

function beforeSync() {
    Materialize.toast(_("synchronizing..."), toastTime, toastInfo);
}

function afterSync() {
    global.availablePkgs = getPkgNames();
    Materialize.toast(
        "<i class='material-icons'>play_arrow</i>" + _("synchronized"),
        toastTime,
        toastSuccess
    );
    global.sync = false;
}

function sync() {
    global.TERMINAL.run(
        "migasfree -u",
        "sync",
        _("synchronization"),
        beforeSync,
        afterSync
    );
}

function syncEveryDay() {
    setTimeout(syncEveryDay, 24 * 60 * 60 * 1000);
    sync();
}

function renderRun(idx) {
    const fs = require("fs");
    const mustache = require("mustache");

    var data = {
        id: idx,
        date: global.terminal[idx].date,
        icon: global.terminal[idx].icon,
        header: global.terminal[idx].header,
        body: global.terminal[idx].body
    };

    return mustache.to_html(
        fs.readFileSync("templates/run.html", "utf8"),
        data
    );
}

function showDetails() {
    const fs = require("fs");
    $("#container").html(fs.readFileSync("templates/details.html", "utf8"));
    global.TERMINAL.refresh();
}

function runAsUserSync(cmd) {
    const execSync = require("child_process").execSync;

    if (getOS() === "Linux") {
        cmd = replaceAll(cmd, '"', '\\"');
        execSync('sudo su -c "' + cmd + '" ' + global.user);
    } else if (getOS() === "Windows") {
        execSync(cmd);
    }
}

function runAsUser(cmd) {
    const exec = require("child_process").exec;

    if (getOS() === "Linux") {
        cmd = replaceAll(cmd, '"', '\\"');
        exec('sudo su -c "' + cmd + '" ' + global.user);
    } else if (getOS() === "Windows") {
        exec(cmd);
    }
}

function supportExternalLinks(event) {
    var href;
    var isExternal = false;

    function crawlDom(element) {
        const mustache = require("mustache");

        if (element.nodeName.toLowerCase() === "a") {
            href = element.getAttribute("href");
        }
        if (element.classList.contains("js-external-link")) {
            isExternal = true;
        }

        if (href && isExternal) {
            event.preventDefault();
            var data = {
                server: global.server,
                cid: global.label.id,
                computer: global.label.name,
                project: global.project,
                uuid: global.uuid
            };
            href = mustache.render(href, data);
            runAsUser(
                "python -c \"import webbrowser; webbrowser.open('" +
                    href +
                    "')\""
            );
        } else if (element.parentElement) {
            crawlDom(element.parentElement);
        }
    }

    crawlDom(event.target);
}

// PMS
function installedPkgs(pks) {
    const execSync = require("child_process").execSync;
    var script = '"' + path.join(gui.__dirname, "py", "installed.py") + '"';
    var cmd = "python " + script + ' "' + pks + '"';

    return execSync(cmd);
}

function postAction(name, pkgs, level) {
    global.packagesInstalled = installedPkgs(global.packages);
    if (pkgs.split(" ").diff(global.packagesInstalled).length === 0) {
        Materialize.toast(
            "<i class='material-icons'>get_app</i> " +
                _("{{name}} installed", { name }),
            toastTime,
            toastSuccess
        );
    } else {
        Materialize.toast(
            "<i class='material-icons'>delete</i> " +
                _("{{name}} deleted", { name }),
            toastTime,
            toastSuccess
        );
    }
    updateStatus(name, pkgs, level);
}

function install(name, pkgs, level) {
    var cmd;

    Materialize.toast(
        _("installing {{name}}...", { name }),
        toastTime,
        toastInfo
    );

    if (getOS() === "Linux") {
        cmd = 'LANG_ALL=C echo "y" | migasfree -ip "' + pkgs + '"';
    } else if (getOS() === "Windows") {
        cmd = 'migasfree -ip "' + pkgs + '"';
    }

    global.TERMINAL.run(cmd, "action-" + slugify(name), name, null, function() {
        postAction(name, pkgs, level);
    });
}

function uninstall(name, pkgs, level) {
    var cmd;

    Materialize.toast(
        _("deleting {{name}}...", { name }),
        toastTime,
        toastInfo
    );

    if (getOS() === "Linux") {
        cmd = 'LANG_ALL=C echo "y" | migasfree -rp "' + pkgs + '"';
    } else if (getOS() === "Windows") {
        cmd = 'migasfree -rp "' + pkgs + '"';
    }

    global.TERMINAL.run(cmd, "action-" + slugify(name), name, null, function() {
        postAction(name, pkgs, level);
    });
}

function checkUser(user, password) {
    const execSync = require("child_process").execSync;
    var script = '"' + path.join(gui.__dirname, "py", "check_user.py") + '"';

    try {
        process.env._LOGIN_MP_USER = user;
        process.env._LOGIN_MP_PASS = password;
        execSync("python " + script);
        process.env._LOGIN_MP_USER = "";
        process.env._LOGIN_MP_PASS = "";
        $("#auth").text("yes");

        return true;
    } catch (err) {
        $("#auth").text("");

        swal({
            title: _("Cancelled"),
            html: _("Autentication error"),
            type: "error",
            showCancelButton: false,
            confirmButtonText: "OK",
            confirmButtonColor: colorTheme
        }).then(
            function() {},
            function(dismiss) {
                // dismiss can be 'overlay', 'cancel', 'close', 'esc', 'timer'
                if (dismiss === "cancel") {
                    // nothing
                }
            }
        );

        return false;
    }
}

function modalLogin(name, packagesToInstall, level) {
    const fs = require("fs");
    var resolve = [];

    swal({
        title: _("administrator"),
        html: fs.readFileSync("templates/login.html", "utf8"),
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonColor: colorTheme,
        preConfirm() {
            resolve = [$("#user").val(), $("#password").val()];
        }
    })
        .then(function(result) {
            if (checkUser(resolve[0], resolve[1])) {
                updateStatus(name, packagesToInstall, level);
            }
        })
        .catch(swal.noop);
}

// DEVICES
function getDevs() {
    addTokenHeader();
    axios
        .get(global.baseApi + "/computers/" + global.cid + "/devices/")
        .then(function(response) {
            global.devs = [];
            global.inflicted = [];
            response.data.assigned_logical_devices_to_cid.forEach(function(
                item
            ) {
                global.devs.push(item.id);
            });
            response.data.inflicted_logical_devices.forEach(function(item) {
                global.inflicted.push(item.id);
            });
        })
        .catch(function(error) {
            showError(error.message);
        });
}

function queryDevices() {
    $("#devices").html("");
    $("#preload-next").show();
    spinner("preload-next");
    getDevs();
    queryDevicesPage(
        global.baseApi +
            "/devices/devices/available/" +
            "?cid=" +
            global.label.id +
            "&q=" +
            global.searchPrint
    );
}

function installDevice(dev, feature, id) {
    addTokenHeader();
    axios
        .get(global.baseApi + "/devices/logical/" + id + "/")
        .then(function(response) {
            var atts = response.data.attributes;
            atts.push(global.attCid);
            changeAttributesDevice(dev, feature, id, atts);
        })
        .catch(function(error) {
            showError(error.message);
        });
}

function uninstallDevice(dev, feature, id) {
    addTokenHeader();
    axios
        .get(global.baseApi + "/devices/logical/" + id + "/")
        .then(function(response) {
            var atts = response.data.attributes;
            //delete attribute from array
            var index = atts.indexOf(global.attCid);
            if (index > -1) {
                atts.splice(index, 1);
            }

            changeAttributesDevice(dev, feature, id, atts);
        })
        .catch(function(error) {
            showError(error.message);
        });
}

function updateStatusDevice(dev, feature, id) {
    dev = slugify(dev);
    feature = slugify(feature);

    var slug = dev + feature;
    var el = "#action-" + slug;
    var status = "#status-action-" + slug;
    var assigned = $.inArray(id, global.devs) >= 0;
    var inflicted = $.inArray(id, global.inflicted) >= 0;

    if (global.onlyAssignedDevs) {
        if (assigned || inflicted) {
            $("#dev-" + dev).removeClass("hide");
            $("#logical-action-" + slug).removeClass("hide");
        } else {
            $("#logical-action-" + slug).addClass("hide");
        }
    } else {
        $("#dev-" + dev).removeClass("hide");
        $("#logical-action-" + slug).removeClass("hide");
    }

    try {
        if (assigned) {
            $(el).text("delete");
            $(el).off("click");
            $(el).click(function() {
                uninstallDevice(dev, feature, id);
            });
            $(status).text(_("assigned"));
            $(status).removeClass("hide");
        } else if (inflicted) {
            $(el).addClass("hide");
            $(status).removeClass("hide");
            $(status).text(_("inflicted"));
        } else {
            $(el).text("get_app");
            $(el).off("click");
            $(el).click(function() {
                installDevice(dev, feature, id);
            });
            $(status).text("");
            $(status).addClass("hide");
        }
    } catch (err) {
        // do nothing
    }
}

function changeAttributesDevice(dev, feature, id, atts) {
    addTokenHeader();
    axios
        .patch(
            global.baseApi + "/devices/logical/" + id + "/",
            JSON.stringify({ attributes: atts }),
            {
                headers: {
                    "Content-Type": "application/json"
                }
            }
        )
        .then(function(response) {
            getDevs();
            updateStatusDevice(dev, feature, id);
        })
        .catch(function(error) {
            showError(error.message);
        });
}

function renderDict(data) {
    var ret = "";

    for (var element in data) {
        ret += element + ": " + data[element] + "<br />";
    }

    return ret;
}

function deleteEmptyElement(obj) {
    for (const prop in obj) {
        if (!obj[prop]) {
            delete obj[prop];
        }
    }
}

function renderInfoDevice(data) {
    return renderDict(JSON.parse(data));
}

function renderDevice(dev) {
    const fs = require("fs");
    const mustache = require("mustache");
    var icon, name;

    if (dev.connection.name === "TCP") {
        icon = "assets/printer-net.png";
    } else {
        icon = "assets/printer-local.png";
    }

    var datavar = JSON.parse(dev.data);
    var location = "";
    if (datavar.LOCATION) {
        location = datavar.LOCATION;
        delete datavar.LOCATION;
    }

    deleteEmptyElement(datavar);

    if (datavar.NAME) {
        name = datavar.NAME;
        datavar.MODEL = dev.model.manufacturer.name + " " + dev.model.name;
        delete datavar.NAME;
    } else {
        name = dev.model.manufacturer.name + " " + dev.model.name;
    }

    var data = {
        id: dev.name,
        name,
        idaction: "dev-" + slugify(dev.name),
        icon,
        details: renderDict(datavar),
        truncated: location,
        connection: dev.connection.name
    };

    return mustache.to_html(
        fs.readFileSync("templates/device.html", "utf8"),
        data
    );
}

function renderLogical(logical) {
    const fs = require("fs");
    const mustache = require("mustache");

    var name = logical.feature.name;
    if (logical.alternative_feature_name) {
        name = logical.alternative_feature_name;
    }

    var data = {
        name,
        idaction:
            "action-" + slugify(logical.device.name + logical.feature.name)
    };

    return mustache.to_html(
        fs.readFileSync("templates/logical.html", "utf8"),
        data
    );
}

function getDevice(dev) {
    $("#devices").append(renderDevice(dev));
    addTokenHeader();
    axios
        .get(
            global.baseApi +
                "/devices/logical/available/?cid=" +
                global.cid.toString() +
                "&did=" +
                dev.id
        )
        .then(function(response) {
            $.each(response.data.results, function(i, logical) {
                $("#logicals-dev-" + slugify(logical.device.name)).append(
                    renderLogical(logical)
                );
                updateStatusDevice(
                    logical.device.name,
                    logical.feature.name,
                    logical.id
                );
            });
        })
        .catch(function(error) {
            showError(error.message);
        });
}

function showDeviceItem(data) {
    $.each(data.results, function(i, item) {
        getDevice(item);
    });
    $(".collapsible").collapsible(); // FIXME
}

function queryDevicesPage(url) {
    addTokenHeader();
    axios
        .get(url)
        .then(function(response) {
            showDeviceItem(response.data);
            if (response.data.next) {
                var options = [
                    {
                        selector: "footer",
                        offset: 0,
                        callback() {
                            if (response.data.next) {
                                queryDevicesPage(response.data.next);
                            }
                        }
                    }
                ];
                Materialize.scrollFire(options);
            } else {
                $("#preload-next").hide();
            }
        })
        .catch(function(error) {
            showError(error.message);
        });
}

// APPS
function showCategories(categories) {
    $.each(categories, function(key, value) {
        $("#categories").append($("<option>", { value: key }).text(value));
    });
    $("#categories").val(global.category);
    $("#categories").material_select();
}

function queryCategories() {
    addTokenHeader();
    axios
        .get(global.baseApi + "/catalog/apps/categories/")
        .then(function(response) {
            global.categories = response.data;
            global.categories[0] = _("All");
            showCategories(global.categories);
        })
        .catch(function(error) {
            showError(error.message);
        });
}

function onDemand(application) {
    swal(
        {
            title: application + " " + _("no available"),
            html: global.label.helpdesk + "<br />" + global.label.name,
            type: "warning",
            showCancelButton: false,
            confirmButtonColor: colorTheme
        },
        function() {}
    );
}

function updateStatus(name, packagesToInstall, level) {
    var slug = slugify(name);
    var el = "#action-" + slug;
    var status = "#status-action-" + slug;
    var descr = "#description-action-" + slug;
    var installed;

    if (packagesToInstall == "") {
        installed = false;
    } else {
        installed =
            packagesToInstall.split(" ").diff(global.packagesInstalled)
                .length === 0;
    }

    if (global.onlyInstalledApps && installed === false) {
        $("#card-action-" + slug).addClass("hide");
    } else {
        $("#card-action-" + slug).removeClass("hide");
    }

    try {
        if (packagesToInstall.split(" ").diff(global.availablePkgs) == "") {
            // AVAILABLE
            if ($("#auth").text() === "" && level === "A") {
                // NO LOGIN
                $(el).text("person");
                $(el).off("click");
                $(el).click(function() {
                    modalLogin(name, packagesToInstall, level);
                });
                if (installed) {
                    $(status).removeClass("hide");
                    $(descr).off("click");
                    $(descr).click(function() {
                        modalLogin(name, packagesToInstall, level);
                    });
                } else {
                    $(status).addClass("hide");
                }
            } else {
                if (installed) {
                    $(el).text("delete");
                    $(el).off("click");
                    $(el).click(function() {
                        uninstall(name, packagesToInstall, level);
                    });
                    $(status).removeClass("hide");
                } else {
                    if (packagesToInstall != "") {
                        $(el).text("get_app");
                        $(el).off("click");
                        $(el).click(function() {
                            install(name, packagesToInstall, level);
                        });
                        $(status).addClass("hide");
                    }
                }
            }
        } else {
            // IS NOT AVAILABLE
            $(el).text("lock_open");
            $(el).off("click");
            $(el).click(function() {
                onDemand(name);
            });
        }
    } catch (err) {
        // do nothing
    }
}

function renderRating(score) {
    var rating = "";

    for (var i = 0; i < score; i++) {
        rating += "<i class='material-icons tiny md-12'>star</i>";
    }
    for (var j = score; j < 5; j++) {
        rating +=
            "<i class='material-icons tiny md-12 blue-grey-text text-lighten-4'>star</i>";
    }

    return rating;
}

function renderApp(item) {
    const fs = require("fs");
    const marked = require("marked");
    const mustache = require("mustache");
    var renderer = new marked.Renderer();
    var data;
    var truncatedDesc = "";

    renderer.heading = function(text, level) {
        var escapedText = text.toLowerCase().replace(/[^\w]+/g, "-");
        return (
            "<h" +
            (level + 3) +
            "><a name='" +
            escapedText +
            "' class='anchor' href='#" +
            escapedText +
            "'></a><span>" +
            text +
            "</span></h" +
            (level + 3) +
            ">"
        );
    };

    if (item.description) {
        truncatedDesc = item.description.split("\n")[0];

        data = {
            server: global.server,
            cid: global.label.id,
            computer: global.label.name,
            project: global.project,
            uuid: global.uuid,
            app: item.name,
            _app: slugify(item.name)
        };
        item.description = mustache.render(item.description, data);
    }

    data = {
        name: item.name,
        idaction: "action-" + slugify(item.name),
        icon: item.icon,
        description: marked(item.description, { renderer }),
        truncated: truncatedDesc,
        category: item.category.name,
        rating: renderRating(item.score),
        txt_installed: _("installed"),
        exists_title: truncatedDesc,
        exists_description: item.description.split("\n").length > 1
    };

    return mustache.to_html(
        fs.readFileSync("templates/app.html", "utf8"),
        data
    );
}

function showAppItem(data) {
    $.each(data.results, function(i, item) {
        if (item.category.id == global.category || global.category == 0) {
            $.each(item.packages_by_project, function(i, pkgs) {
                if (pkgs.project.name == global.project) {
                    $("#apps").append(renderApp(item));
                    updateStatus(
                        item.name,
                        pkgs.packages_to_install.join(" "),
                        item.level.id
                    );
                }
            });
        }
    });
    $(".collapsible").collapsible(); // FIXME
}

function queryAppsPage(url) {
    if (global.flagApps) {
        global.flagApps = false;
        addTokenHeader();
        axios
            .get(url)
            .then(function(response) {
                $.each(response.data.results, function(i, item) {
                    $.each(item.packages_by_project, function(i, pkgs) {
                        if (pkgs.project.name == global.project) {
                            global.packages +=
                                " " + pkgs.packages_to_install.join(" ");
                        }
                    });
                });

                global.packagesInstalled = installedPkgs(global.packages);

                showAppItem(response.data);

                if (response.data.next) {
                    var options = [
                        {
                            selector: "footer",
                            offset: 0,
                            callback() {
                                if (response.data.next) {
                                    queryAppsPage(response.data.next);
                                }
                            }
                        }
                    ];
                    Materialize.scrollFire(options);
                } else {
                    $("#preload-next").hide();
                }
                global.flagApps = true;
            })
            .catch(function(error) {
                showError(error.message);
            });
    }
}

function queryApps() {
    var categoryFilter = "";

    $("#apps").html("");
    $("#preload-next").show();
    global.packages = "";

    if (global.category !== 0) {
        categoryFilter = "&category=" + global.category;
    }

    spinner("preload-next");

    queryAppsPage(
        global.baseApi +
            "/catalog/apps/available/?cid=" +
            global.label.id +
            "&q=" +
            global.search +
            categoryFilter
    );
}

function showDescription(id) {
    $("#trunc-" + id).hide();
    $("#descr-" + id).show();
}

function showTruncated(id) {
    $("#descr-" + id).hide();
    $("#trunc-" + id).show();
}

function changedCategory() {
    global.category = $("#categories").val();
    queryApps();
}

function changedOnlyInstalledApps() {
    global.onlyInstalledApps = $("#only_apps_installed").prop("checked");
    queryApps();
}

function changedOnlyAssignedDevs() {
    global.onlyAssignedDevs = $("#only_devs_assigned").prop("checked");
    queryDevices();
}

function getChar(event) {
    var keyCode = "which" in event ? event.which : event.keyCode;

    if (keyCode === 13) {
        // Enter
        global.search = $("#search").val();
        queryApps();
    }
}

function getCharPrint(event) {
    var keyCode = "which" in event ? event.which : event.keyCode;

    if (keyCode === 13) {
        // Enter
        global.searchPrint = $("#searchPrint").val();
        queryDevices();
    }
}

function showDevices() {
    const fs = require("fs");
    const mustache = require("mustache");
    var data = {
        txt_search: _("search"),
        txt_assigned: _("assigned")
    };

    $("#container").html(
        mustache.to_html(
            fs.readFileSync("templates/devices.html", "utf8"),
            data
        )
    );

    spinner("devices");
    $("#only_devs_assigned").prop("checked", global.onlyAssignedDevs);

    queryDevices();

    $("#searchPrint").val(global.searchPrint);
    $("#searchPrint").bind("keydown", getCharPrint);
    $("#searchPrint").focus();

    $("#only_devs_assigned").change(changedOnlyAssignedDevs);
}

function showApps() {
    const fs = require("fs");
    const mustache = require("mustache");

    queryCategories();
    var data = {
        txt_search: _("search"),
        txt_installed: _("installed")
    };

    $("#container").html(
        mustache.to_html(fs.readFileSync("templates/apps.html", "utf8"), data)
    );
    spinner("apps");
    $("#only_apps_installed").prop("checked", global.onlyInstalledApps);

    queryApps();

    $("#categories").change(changedCategory);
    $("#search").val(global.search);
    $("#search").bind("keydown", getChar);
    $("#search").focus();

    $("#only_apps_installed").change(changedOnlyInstalledApps);
}

function renderTag(tag) {
    const fs = require("fs");
    const mustache = require("mustache");
    var data = {
        tag
    };

    return mustache.to_html(
        fs.readFileSync("templates/tag.html", "utf8"),
        data
    );
}

// LABEL
function printLabel() {
    window.print();
}

function showLabel() {
    const fs = require("fs");
    const pk = require("./package.json");
    const mustache = require("mustache");
    var data = {
        server: global.server,
        app_name: pk.name,
        app_version: pk.version,
        app_description: _(pk.description),
        app_copyright: pk.copyright,
        app_author: pk.author,
        cid: global.label.id,
        name: global.label.name,
        project: global.project,
        user: global.user,
        uuid: global.uuid,
        helpdesk: global.label.helpdesk,
        ip: global.ip,
        mask: global.mask,
        network: global.network,
        computer: global.computer,
        txt_status: _(global.computer.status),
        qrcode: mustache.to_html(
            fs.readFileSync("templates/qrcode.html", "utf8"),
            {
                qrcode: global.qr.createImgTag(2, 2)
            }
        ),
        qrcode2: mustache.to_html(
            fs.readFileSync("templates/qrcode2.html", "utf8"),
            { qrcode: global.qr.createImgTag(3, 3) }
        )
    };

    $("#container").html(
        mustache.to_html(
            fs.readFileSync("templates/information.html", "utf8"),
            data
        )
    );

    global.computer.tags.forEach(function(tag) {
        $("#tags").append(renderTag(tag));
    });

    $("#print-label").click(printLabel);

    labelDone();
}

// SETTINGS
function getSettings() {
    global.settings.language = $("#language").val();
    global.settings.theme = "dark";
    global.settings.showSyncDetails = $("#show_details_to_sync").is(":checked");
}

function setSettings() {
    $("#show_details_to_sync").prop("checked", global.settings.showSyncDetails);
    $("#language").val(global.settings.language);
}

function showSettings() {
    const fs = require("fs");
    const mustache = require("mustache");
    var data = {
        txt_synchronize: _("Show details to synchronize")
    };

    $("#container").html(
        mustache.to_html(
            fs.readFileSync("templates/settings.html", "utf8"),
            data
        )
    );

    setSettings();

    $("#show_details_to_sync").change(function() {
        getSettings();
        saveSettings(global.settings);
    });

    $("#language").append(
        $("<option>", {
            value: "en",
            text: "English"
        })
    );
    $("#language").append(
        $("<option>", {
            value: "es",
            text: "Español"
        })
    );

    $("#language").val(global.settings.language);
    $("#language").material_select();

    $("#language").change(function() {
        getSettings();
        saveSettings(global.settings);
    });
}

function loadTerminal() {
    if (!global.sync) {
        $.each(global.terminal, function(i, term) {
            $("#console").append(renderRun(i));
        });
    }
    if (global.idx) {
        $(".collapsible").collapsible();
        $(
            "#console > li:nth-child(" +
                global.idx +
                ") > div.collapsible-header"
        ).click();
        window.scrollTo(0, document.body.scrollHeight);
    }
}

function formatDate(date) {
    var dateFormat = require("dateformat");

    return dateFormat(date, "yyyy-mm-dd HH:MM:ss");
}

function getGlobalData() {
    const fs = require("fs");
    const execSync = require("child_process").execSync;
    var myArgs = gui.App.argv;

    if (typeof global.search === "undefined") {
        global.search = "";
    }

    if (typeof global.searchPrint === "undefined") {
        global.searchPrint = "";
    }

    readSettings();
    global.running = false;

    global.TERMINAL = (function() {
        if (typeof global.terminal == "undefined") {
            global.terminal = {};
        }
        var stdErr = "";

        function addToStdErr(txt) {
            stdErr += txt;
        }

        return {
            add(txt) {
                try {
                    global.terminal[global.runIdx].body = replaceColors(
                        global.terminal[global.runIdx].body + txt
                    );
                    this.refresh();
                } catch (err) {
                    // do nothing
                }
            },
            refresh() {
                try {
                    $("#" + global.runIdx).html(
                        global.terminal[global.runIdx].body
                    );
                    if ($("#console").length > 0) {
                        if (
                            $(
                                "#console > li:nth-child(" +
                                    global.idx +
                                    ") > div.collapsible-body"
                            ).attr("style") !== "display: none;"
                        ) {
                            window.scrollTo(0, document.body.scrollHeight);
                        }
                    }
                } catch (err) {
                    // do nothing
                }
            },
            run(
                cmd,
                id,
                txt = "",
                beforeCallback = null,
                afterCallback = null
            ) {
                if (global.running) {
                    Materialize.toast(
                        "<i class='material-icons'>warning</i>" +
                            _("please wait, other process is running!!!"),
                        toastTime,
                        toastError
                    );
                } else {
                    global.running = true;

                    $("#" + id).addClass("blink");

                    if (beforeCallback) {
                        beforeCallback();
                    }

                    var spawn = require("child_process").spawn;
                    var process;

                    if (getOS() === "Linux") {
                        process = spawn("bash", ["-c", cmd]);
                    } else if (getOS() === "Windows") {
                        process = spawn("cmd", ["/C", cmd]);
                    }

                    var date = new Date();

                    global.idx += 1;
                    global.runIdx = "_run_" + global.idx.toString();
                    global.terminal[global.runIdx] = {
                        icon: $("#" + id).text(),
                        date: formatDate(date),
                        header: txt,
                        body: ""
                    };

                    $("#console").append(renderRun(global.runIdx));
                    $(
                        "#console > li:nth-child(" +
                            global.idx +
                            ") > div.collapsible-header"
                    ).click();

                    process.stdout.on("data", function(data) {
                        global.TERMINAL.add(data.toString());
                    });

                    process.stderr.on("data", function(data) {
                        addToStdErr(data.toString());
                        global.TERMINAL.add(
                            "<span class='red'>" + data.toString() + "</span>"
                        );
                    });

                    // when the spawn child process exits, check if there were any errors
                    process.on("exit", function(code) {
                        if (code !== 0) {
                            // Syntax error
                            Materialize.toast(
                                "<i class='material-icons'>error</i> error:" +
                                    code +
                                    " " +
                                    cmd,
                                toastTime,
                                toastError
                            );
                            win.show();
                        } else {
                            if (stdErr === "") {
                                if (afterCallback) {
                                    afterCallback();
                                }

                                if (id == "sync" && document.hidden) {
                                    // sync ok & minimized -> exit
                                    exit();
                                }
                            } else {
                                Materialize.toast(
                                    "<i class='material-icons'>error</i>" +
                                        replaceColors(stdErr),
                                    toastTime,
                                    toastError
                                );
                                stdErr = "";
                            }
                        }

                        global.TERMINAL.add("<hr />");

                        $("#" + id).removeClass("blink");

                        saveTerminal();

                        global.running = false;
                    });
                }
            }
        };
    })();

    if (typeof global.sync === "undefined") {
        global.sync = myArgs === "sync";
    }

    if (typeof global.conf === "undefined") {
        global.conf = execSync(
            "python -c \"from __future__ import print_function; from migasfree_client import settings; print(settings.CONF_FILE, end='')\""
        );
    }

    if (typeof global.server === "undefined") {
        global.server = execSync(
            "python -c \"from __future__ import print_function; from migasfree_client.utils import get_config; print(get_config('" +
                global.conf +
                "', 'client').get('server', 'localhost'), end='')\""
        );
    }

    global.baseUrl = "http://" + global.server;
    axios.defaults.baseURL = global.baseUrl;

    global.baseApi = global.baseUrl + "/api/v1/token";

    if (typeof global.token === "undefined") {
        var tokenfile = path.join(process.cwd(), "token");
        if (fs.existsSync(tokenfile)) {
            global.token = "token " + fs.readFileSync(tokenfile, "utf8");
        } else {
            getToken();
        }
    }

    if (typeof global.uuid === "undefined") {
        global.uuid = execSync(
            "python -c \"from __future__ import print_function; from migasfree_client.utils import get_hardware_uuid; print(get_hardware_uuid(), end='')\""
        );
    }

    if (typeof global.project === "undefined") {
        global.project = execSync(
            "python -c \"from __future__ import print_function; from migasfree_client.utils import get_mfc_project; print(get_mfc_project(), end='')\""
        );
    }

    if (typeof global.computername === "undefined") {
        global.computername = execSync(
            "python -c \"from __future__ import print_function; from migasfree_client.utils import get_mfc_computer_name; print(get_mfc_computer_name(), end='')\""
        );
    }

    if (typeof global.network === "undefined") {
        global.network = execSync(
            "python -c \"from __future__ import print_function; from migasfree_client.network import get_iface_net, get_iface_cidr, get_ifname; _ifname = get_ifname(); print('%s/%s' % (get_iface_net(_ifname), get_iface_cidr(_ifname)), end='')\""
        );
    }

    if (typeof global.mask === "undefined") {
        global.mask = execSync(
            "python -c \"from __future__ import print_function; from migasfree_client.network import get_iface_mask, get_ifname; _ifname = get_ifname(); print(get_iface_mask(_ifname), end='')\""
        );
    }

    if (typeof global.ip === "undefined") {
        global.ip = execSync(
            "python -c \"from __future__ import print_function; from migasfree_client.network import get_iface_address, get_ifname; _ifname = get_ifname(); print(get_iface_address(_ifname), end='')\""
        );
    }

    if (typeof global.user === "undefined") {
        global.user = execSync(
            "python -c \"from __future__ import print_function; from migasfree_client import utils; _graphic_pid, _graphic_process = utils.get_graphic_pid(); print(utils.get_graphic_user(_graphic_pid), end='')\""
        );
    }

    if (typeof global.serverVersion === "undefined") {
        getServerVersion();
    }

    global.flagApps = true;

    // LABEL
    axios
        .get(global.baseUrl + "/get_computer_info/?uuid=" + global.uuid)
        .then(function(response) {
            global.label = response.data;
            global.cid = global.label.id;
            getAttributeCID();

            addTokenHeader();
            axios
                .get("/api/v1/token/computers/" + global.cid + "/")
                .then(function(response) {
                    global.computer = response.data;
                    global.computer.ram =
                        (global.computer.ram / 1024 / 1024 / 1024).toFixed(1) +
                        " GB";
                    global.computer.storage =
                        (global.computer.storage / 1024 / 1024 / 1024).toFixed(
                            1
                        ) + " GB";
                    if (global.computer.machine == "V") {
                        global.computer.machine = "(virtual)";
                    } else {
                        global.computer.machine = "";
                    }

                    labelDone();

                    if (!global.sync) {
                        if (global.settings.showAppsMenu) {
                            showApps();
                        } else if (global.settings.showDevicesMenu) {
                            showDevices();
                        } else {
                            showDetails();
                        }
                    }
                })
                .catch(function(error) {
                    showError(error.message);
                });
        });

    if (typeof global.category === "undefined") {
        global.category = 0;
    }

    if (typeof global.onlyInstalledApps === "undefined") {
        global.onlyInstalledApps = false;
    }

    if (typeof global.onlyAssignedDevs === "undefined") {
        global.onlyAssignedDevs = false;
    }

    if (typeof global.availablePkgs === "undefined") {
        global.availablePkgs = getPkgNames();
    }
}

function ready() {
    const fs = require("fs");

    global.idx = 0;
    getGlobalData();
    $("#sync").click(sync);
    if (global.sync) {
        if (fs.existsSync(consoleLog)) {
            fs.unlinkSync(consoleLog);
            global.terminal = {};
        }
        if (global.settings.showSyncDetails) {
            win.show();
        } else {
            win.show();
            win.minimize();
        }
        showDetails();
        syncEveryDay();
    } else {
        setTimeout(syncEveryDay, 24 * 60 * 60 * 1000);
        fs.stat(consoleLog, function(err, stat) {
            if (err === null) {
                // consoleLog exists
                var data = fs.readFileSync(consoleLog, "utf8");
                global.terminal = JSON.parse(data);
                global.idx = Object.keys(global.terminal).length;
            }
        });

        win.show();
    }

    if (!global.settings.showAppsMenu) {
        $("#menu-apps").addClass("hide");
    }

    if (!global.settings.showDevicesMenu) {
        $("#menu-devices").addClass("hide");
    }

    if (!global.settings.showDetailsMenu) {
        $("#menu-details").addClass("hide");
    }

    if (!global.settings.showInfoMenu) {
        $("#menu-information").addClass("hide");
    }

    if (!global.settings.showSettingsMenu) {
        $("#menu-settings").addClass("hide");
    }

    if (!global.settings.showHelpMenu) {
        $("#menu-help").addClass("hide");
    }

    $("#menu-apps").prop("title", _("Applications"));
    $("#menu-apps").click(showApps);

    $("#menu-devices").prop("title", _("Devices"));
    $("#menu-devices").click(showDevices);

    $("#menu-details").prop("title", _("Details"));
    $("#menu-details").click(showDetails);

    $("#menu-information").prop("title", _("Information"));
    $("#menu-information").click(showLabel);

    $("#menu-settings").prop("title", _("Settings"));
    $("#menu-settings").click(showSettings);

    $("#menu-help").prop("title", _("Help"));
}
