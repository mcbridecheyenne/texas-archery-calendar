//*-*-*-*-*-*-*-*-*-*-*-*
//  START OF DOM READY
//*-*-*-*-*-*-*-*-*-*-*-*
$(document).ready(function () {
  //cookies
  checkCookies();
  //cookie button
  $(document).on("click", ".cookieButton a", function (e) {
    e.preventDefault();
    $(".cookieBar").removeClass("show");
    createCookie("cookiecookie", "on", 30);
  });

  //console.log(location.hash);

  if (location.hash == "#membership-calculator") {
    setTimeout(function () {
      $("html, body").scrollTop(0).show();
      $("html,body").animate(
        {
          scrollTop: $("#membership-calculator").offset().top - 130,
        },
        500,
      );
    }, 0);
  }

  $(".homeSlider").slick({
    slidesToShow: 1,
    dots: true,
    arrows: false,
    infinite: true,
    fade: true,
    autoplay: true,
    autoplaySpeed: 6000,
    pauseOnHover: true,
  });

  $(".overlayNav").addClass("loaded");

  $(".menuButton").on("click", function (e) {
    e.preventDefault();
    var menuButton = $(this);
    menuButton.toggleClass("open");
    if (menuButton.hasClass("open")) {
      menuButton.children("span").html("Close");
    } else {
      menuButton.children("span").html("Menu");
    }
    $(".overlayNav").toggleClass("open");
  });

  $(".searchLink").on("click", function (e) {
    e.preventDefault();
    var searchLink = $(this);
    searchLink.toggleClass("open");
    if (searchLink.hasClass("open")) {
      searchLink.children("span").html("Close");
      $("#search_form #term").focus();
    } else {
      searchLink.children("span").html("Search");
    }
    searchLink.children(".closeIcon").toggleClass("hide");
    searchLink.children(".searchIcon").toggleClass("hide");
    $(".searchBar").toggleClass("open");
  });

  $(".mainNav .link.hasSubNav > a").on("click", function (e) {
    e.preventDefault();
    var link = $(this);
    link.toggleClass("active");
    link.siblings("ul").toggleClass("active");
    if (link.hasClass("active")) {
      link.children("span").html("-");
    } else {
      link.children("span").html("+");
    }
  });

  //accordion id's for cache
  var count = 1;
  $("button.accordion").each(function (e) {
    $(this).attr("id", "accordion_" + count);
    count++;
  });

  //accordions
  $(document).on("click", ".accordion", function (e) {
    var acc = $(this);
    if (acc.parent().next(".panel").length) {
      var panel = acc.parent().next(".panel");
    } else {
      var panel = acc.next(".panel");
    }
    var h = panel.children(".inner").outerHeight();

    //console.log(h);

    if (!acc.hasClass("active") && $(".accordion.active").length) {
      $(".accordion.active").removeClass("active");
      $(".panel").css("max-height", 0);
    }

    acc.toggleClass("active");

    if (!acc.hasClass(".dashboardNavAccordion")) {
      if (acc.hasClass("active")) {
        panel.css("max-height", h);
        //scroll to panel
        setTimeout(function () {
          $("html, body").animate(
            {
              scrollTop: acc.offset().top - 100,
            },
            500,
          );
        }, 300);
        if (typeof Storage !== "undefined") {
          sessionStorage.openaccordion = acc.attr("id");
          sessionStorage.currentpage = window.location.href;
        }
      } else {
        panel.css("max-height", 0);
        if (typeof Storage !== "undefined") {
          sessionStorage.removeItem("openaccordion");
          sessionStorage.removeItem("currentpage");
        }
      }
    }
  });

  //open accordion from cache if going back to same page
  if (typeof Storage !== "undefined") {
    if (sessionStorage.openaccordion) {
      //open accordion exists, but are we on the same page?
      if (window.location.href == sessionStorage.currentpage) {
        $("#" + sessionStorage.openaccordion).trigger("click");
      }
    } else {
      //console.log('no accordion');
    }
  }

  //tabs
  $(document).on("click", ".tabList li a", function (e) {
    e.preventDefault();
    var tab = $(this);
    var link = tab.attr("href");
    if (!tab.parent("li").hasClass("active")) {
      //not open already so change info
      $(".tabContent.active").removeClass("active");
      $(".tabList li.active").removeClass("active");
      tab.parent("li").addClass("active");
      $(".tabContent" + link).addClass("active");
      window.history.pushState("", "", window.location.pathname + link);
      if (typeof Storage !== "undefined") {
        sessionStorage.opentab = link;
        sessionStorage.currentevent = window.location.pathname;
      }
    }
  });

  //open tab from cache if one exists in url
  if (typeof Storage !== "undefined") {
    if (sessionStorage.currentevent == window.location.pathname) {
      //on same page as last event, open a tab if its stored
      if (sessionStorage.opentab) {
        if ($(window).width() > 860) {
          $(
            '.desktopTabs.tabList li a[href="' + sessionStorage.opentab + '"]',
          ).trigger("click");
        } else {
          $(
            '.mobileTabs.tabList li a[href="' + sessionStorage.opentab + '"]',
          ).trigger("click");
        }
      }
    } else {
      //console.log('no tab');
    }
  }

  $(document).on("click", ".finderWrapper .results .oneResult", function (e) {
    //console.log(e.target);
    if (e.target.tagName.toLowerCase() !== "a") {
      e.preventDefault();
    }

    var chosen = $(this);
    var lat = chosen.attr("data-lat");
    var lng = chosen.attr("data-lng");
    var addr1 = chosen.attr("data-addr1");
    var postcode = chosen.attr("data-postcode");
    var name = chosen.attr("data-name");
    //console.log("lat: " + lat + " and lng: " + lng);
    //update map and link here
    //link
    $(".finderWrapper .map #map_link").attr(
      "href",
      "https://www.google.com/maps/dir//" +
        name +
        "," +
        addr1 +
        "," +
        postcode +
        "/@" +
        lat +
        "," +
        lng +
        ",14z",
    );
    //map
    $(".finderWrapper .map #map").css(
      "background-image",
      "url('https://maps.googleapis.com/maps/api/staticmap?center=" +
        lat +
        "," +
        lng +
        "&zoom=15" +
        "&maptype=roadmap" +
        "&size=620x620" +
        "&scale=2" +
        "&markers=icon:https://nfaa.93ft.com/images/icons/marker-grey.svg%7C" +
        lat +
        "," +
        lng +
        "&&style=feature:road.arterial%7Celement:geometry.fill%7Ccolor:0xffffff%7Cgamma:0.62&style=feature:landscape.man_made%7Celement:geometry%7Ccolor:0xe3dbc2&style=feature:landscape.natural%7Celement:geometry%7Ccolor:0xe5dfcd&style=feature:landscape.natural.terrain%7Celement:geometry%7Cvisibility:on&style=feature:poi%7Celement:labels%7Cvisibility:off&style=feature:poi.business%7Celement:all%7Cvisibility:off&style=feature:poi.medical%7Celement:geometry%7Ccolor:0xfbd3da&style=feature:poi.park%7Celement:geometry%7Ccolor:0xbde6ab&style=feature:road%7Celement:geometry.stroke%7Cvisibility:on&style=feature:road%7Celement:labels%7Cvisibility:on&style=feature:road.highway%7Celement:geometry.fill%7Ccolor:0xf7eecc&style=feature:road.highway%7Celement:geometry.stroke%7Ccolor:0xefd151&style=feature:road.local%7Celement:geometry.fill%7Ccolor:0x000&style=feature:transit.station.airport%7Celement:geometry.fill%7Ccolor:0xe9e9e9&style=feature:water%7Celement:geometry%7Ccolor:0x89bad1%7C" +
        "&key=AIzaSyCaKpttDX6chbxw1TFK6cBIuQefXO58CXI')",
    );
    $(".finderWrapper .results .oneResult.active").removeClass("active");
    chosen.addClass("active");
  });

  //resources
  $(document).on("change", "select#category", function () {
    var val = $("select#category").val();
    var select = $("select#subcategory");

    if (val == "") {
      select.html("");
      select.html(
        '<option class="label" value="">Choose Sub Category</option>',
      );
      select.prop("disabled", true);
    } else {
      url = "../php/ajax/getResourceSubCategories.php?parent_url=" + val;
      url = encodeURI(url);

      $.get(url, function (data) {
        select.html("");
        select.html(data);
        select.prop("disabled", false);
      });
    }
  });

  $(document).on("submit", "#resource_search", function (e) {
    e.preventDefault();
    $("#filter_resources").trigger("click");
  });

  $(document).on("click", ".filterResources", function (e) {
    e.preventDefault();
    var keyword = $("#keyword").val();
    var category = $("select#category").val();
    var subcategory = $("select#subcategory").val();
    //alert(keyword);

    if (category == "" && keyword == "") {
      $("#resource_results").html(
        '<tr class="titleRow"><td class="searchTitle" colspan="6"><h2 class="title navy font30">Please enter a keyword or select a category.</h2></td></tr>',
      );
    } else {
      url =
        "../php/ajax/filterResources.php?category=" +
        category +
        "&subcategory=" +
        subcategory +
        "&keyword=" +
        keyword;
      url = encodeURI(url);

      if (category != "") {
        history.replaceState(
          "",
          "Resource Center | NFAA",
          "/resources/" + category + "/" + subcategory,
        );
      }
      //console.log(url);

      $.get(url, function (data) {
        $("#resource_results").html(data);
      });
    }
  });

  $(document).on("submit", "#resource_search", function (e) {
    e.preventDefault();
    $("#filter_clubs").trigger("click");
  });

  $(document).on("submit", "#keyword_search", function (e) {
    e.preventDefault();
    $("#filter_clubs").trigger("click");
  });

  $(document).on("click", ".filterClubs", function (e) {
    e.preventDefault();
    var zipcode = $("#zipcode").val();
    var keyword = $("#keyword").val();
    //var distance = $("select#distance").val();
    var type = $("select#type").val();
    var range = $("select#range").val();
    var state = $("select#state").val();
    //alert(keyword);
    var lat = "";
    var lng = "";

    if (zipcode != "") {
      var geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { address: zipcode + ", US" },
        function (results, status) {
          //console.log(results);
          if (status == google.maps.GeocoderStatus.OK) {
            center = results[0].geometry.location;
            lat = center.lat();
            lng = center.lng();
            //console.log("lat=" + lat + " and lng=" + lng);

            url =
              "../php/ajax/filterClubs.php?zipcode=" +
              zipcode +
              "&keyword=" +
              keyword +
              "&type=" +
              type +
              "&range=" +
              range +
              "&state=" +
              state +
              "&lat=" +
              lat +
              "&lng=" +
              lng;
            url = encodeURI(url);
            //console.log(url);

            $.get(url, function (data) {
              $(".finderWrapper").html(data);
            });
          } else {
            $(".finderWrapper").html(
              "<div class='results noResults'><h2 class='title navy font30'>No address found for supplied zip code.</h2></div>",
            );
            return;
          }
        },
      );
    } else {
      url =
        "../php/ajax/filterClubs.php?type=" +
        type +
        "&keyword=" +
        keyword +
        "&state=" +
        state +
        "&range=" +
        range;
      url = encodeURI(url);
      //console.log(url);

      $.get(url, function (data) {
        $(".finderWrapper").html(data);
        //console.log(data);
      });
    }
  });

  $(document).on("submit", ".resource_search", function (e) {
    e.preventDefault();
    $("#filter_ranges").trigger("click");
  });

  $(document).on("submit", "#keyword_search", function (e) {
    e.preventDefault();
    $("#filter_ranges").trigger("click");
  });

  $(document).on("click", ".filterRanges", function (e) {
    e.preventDefault();
    var zipcode = $("#zipcode").val();
    var keyword = $("#keyword").val();
    //var distance = $("select#distance").val();
    var range = $("select#range").val();
    var state = $("select#state").val();
    //alert(keyword);
    var lat = "";
    var lng = "";

    if (zipcode != "") {
      var geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { address: zipcode + ", US" },
        function (results, status) {
          //console.log(results);
          if (status == google.maps.GeocoderStatus.OK) {
            center = results[0].geometry.location;
            lat = center.lat();
            lng = center.lng();
            //console.log("lat=" + lat + " and lng=" + lng);

            url =
              "../php/ajax/filterRanges.php?zipcode=" +
              zipcode +
              "&keyword=" +
              keyword +
              "&range=" +
              range +
              "&state=" +
              state +
              "&lat=" +
              lat +
              "&lng=" +
              lng;
            url = encodeURI(url);
            //console.log(url);

            $.get(url, function (data) {
              $(".finderWrapper").html(data);
            });
          } else {
            $(".finderWrapper").html(
              "<div class='results noResults'><h2 class='title navy font30'>No address found for supplied zip code.</h2></div>",
            );
            return;
          }
        },
      );
    } else {
      url =
        "../php/ajax/filterRanges.php?state=" +
        state +
        "&range=" +
        range +
        "&keyword=" +
        keyword;
      url = encodeURI(url);
      //console.log(url);

      $.get(url, function (data) {
        $(".finderWrapper").html(data);
        //console.log(data);
      });
    }
  });

  $(document).on("click", ".filterEvents", function (e) {
    e.preventDefault();
    var keyword = $("input#keyword").val();
    var level = $("select#level").val();
    var category = $("select#category").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();
    var page = 0;

    if (level == "") {
      level = 0;
    }

    if (category == "") {
      category = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    $(".eventsCalendar").html(
      '<h2 class="monthTitle first title navy font30"><span class="thin-title red">Loading...</span></h2>',
    );

    url =
      "../php/ajax/filterCompetitions.php?keyword=" +
      keyword +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&level=" +
      level +
      "&category=" +
      category +
      "&page=" +
      page +
      "&run=true";
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".eventsCalendar").html(data);
      var hide = $("#hide").val();
      if (hide == "hide") {
        $(".loadMoreHolder").remove();
      }
    });
  });

  //load more events
  $(document).on("click", ".loadMoreEvents", function (e) {
    e.preventDefault();
    var keyword = $("input#keyword").val();
    var level = $("select#level").val();
    var category = $("select#category").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();

    if (level == "") {
      level = 0;
    }

    if (category == "") {
      category = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    var page = $(".loadMoreEvents").attr("data-page");

    //$('.loadMoreHolder').html('<h2 class="loadingTitle">Loading...</h2>');

    url =
      "../php/ajax/filterCompetitions.php?level=" +
      level +
      "&category=" +
      category +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&keyword=" +
      keyword +
      "&page=" +
      page +
      "&run=true";
    url = encodeURI(url);

    $.get(url, function (data) {
      $(".loadMoreHolder").remove();
      var data_split = data.split("~~~~~");
      console.log(data_split[0]);
      $(".eventsCalendar").append(data_split[0]);
      $(".eventsCalendar").append(data_split[1]);
    });
  });

  $(document).on("change", ".newsFilters #category", function (e) {
    var selected = $(this).val();
    window.location.href = "/news/category/" + selected;
  });

  $(document).on("submit", "#membership_calculator", function (e) {
    e.preventDefault();
    var state = $("#state").val();
    var membership_type = $("#membership_type").val();
    url =
      "../php/ajax/calculateMembership.php?state=" +
      state +
      "&membership_type=" +
      membership_type;

    url = encodeURI(url);
    console.log(url);

    $.get(url, function (data) {
      $(".memberCalculator .right .inner").html(data);
    });
  });

  //contact
  $(document).on("submit", "#contact_form", function (e) {
    e.preventDefault();
    var valid = true;

    var email = $("#contact_form #email").val();
    var full_name = $("#contact_form #full_name").val();
    var subject = $("#contact_form #subject").val();
    var message = $("#contact_form #message").val();
    //var recaptcha_response = $("#recaptchaResponse").val();

    if (!isEmail(email)) {
      $("#contact_form .formResponse").html("Please enter a valid email.");
      valid = false;
      return;
    }

    if (full_name == "" || subject == "" || message == "") {
      $("#contact_form .formResponse").html(
        "Please fill in the required fields.",
      );
      valid = false;
      return;
    }

    if (valid) {
      $("#contact_form button").prop("disabled", true);

      url = "../php/ajax/sendContactForm.php";
      url = encodeURI(url);

      post_data = {
        email: email,
        full_name: full_name,
        subject: subject,
        message: message,
        //recaptcha_response: recaptcha_response,
      };

      $.post(url, post_data, function (data) {
        if (data == "success") {
          $("#contact_form")[0].reset();
          $("#contact_form .formResponse").html("Thank you for your inquiry.");
          $("#contact_form .formResponse").addClass("success");
          $("#contact_form button").prop("disabled", false);
        } else {
          $("#contact_form .formResponse").html(data);
          $("#contact_form button").prop("disabled", false);
        }
      });
    }
  });
});
//*-*-*-*-*-*-*-*-*-*-*-*
//   END OF DOM READY
//*-*-*-*-*-*-*-*-*-*-*-*

$(window).on("load", function () {
  //get hash from url and open tab if it exists
  var hash = window.location.hash;
  console.log(hash);
  if (hash) {
    if ($(window).width() > 860) {
      $('.desktopTabs.tabList li a[href="' + hash + '"]').trigger("click");
    } else {
      $('.mobileTabs.tabList li a[href="' + hash + '"]').trigger("click");
    }
  }
});

$(window).on("resize, orientationchange", function () {});

//Start Google Maps Locator
function searchClubs() {
  var address = $("#zipcode").val();
  var geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address: address + ", UK" }, function (results, status) {
    if (status == google.maps.GeocoderStatus.OK) {
      searchClubsNear(results[0].geometry.location);
    } else {
      alert(address + " not found");
    }
  });
}

function searchClubsNear(center) {
  var radius = $("#radiusSelect").val;
  var searchUrl = "../php/ajax/phpsqlsearch_genxml.php";

  post_data = {
    lat: center.lat(),
    lng: center.lng(),
  };

  $.post(searchUrl, post_data, function (data) {
    $("#store_list").html(data);
  });
}

function checkCookies() {
  var cookieState = readCookie("cookiecookie");
  if (cookieState != "on") {
    $(".cookieBar").addClass("show");
  } else {
    $(".cookieBar").removeClass("show");
  }
}

function createCookie(name, value, days) {
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    var expires = "; expires=" + date.toGMTString();
  } else var expires = "";
  document.cookie = name + "=" + value + expires + "; path=/";
}

function readCookie(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(";");
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function eraseCookie(name) {
  createCookie(name, "", -1);
}

function isEmail(email) {
  var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  return regex.test(email);
}
