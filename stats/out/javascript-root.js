/** Smooth Scrolling Functionality **/
var jump = function (e) {
  if (e) {
    //e.preventDefault();
    var target = $(this).attr("href").replace("/", "");
  } else {
    var target = location.hash;
  }

  $("html,body").animate(
    {
      scrollTop: $(target).offset().top - 100,
    },
    500,
  );
};
//*-*-*-*-*-*-*-*-*-*-*-*
//  START OF DOM READY
//*-*-*-*-*-*-*-*-*-*-*-*
$(document).ready(function () {
  checkCookies();

  $(document).on("click", ".errorPopup a", function (e) {
    e.preventDefault();
    closeErrorPopup();
  });

  if (location.hash) {
    setTimeout(function () {
      $("html, body").scrollTop(0).show();
      jump();
    }, 0);
  }

  /*var token_submit = $('#token').val();
	if(token != token_submit){
		e.preventDefault();
		return false;
	}*/

  $(document).on("click", "a", function (e) {
    if (this.hash !== "") {
      //e.preventDefault();
      var hash = this.hash;
      $("html,body").animate(
        {
          scrollTop: $(hash).offset().top - 160,
        },
        500,
      );
    }
  });

  //cookie button
  $(document).on("click", ".cookieButton a", function (e) {
    e.preventDefault();
    $(".cookieBar").removeClass("show");
    createCookie("cookiecookie", "on", 30);
  });

  $(".scrollbar-macosx").scrollbar();
  //$('html.windows .overlayNav').scrollbar();

  $(".shortPageIntro h1, p:not(.eventTitleText)").unorphanize();

  //expand menu
  $(document).on("click", ".topNav .expands", function (e) {
    e.preventDefault();
    var menu_link = $(this).data("link");
    //if no current menus are open, close any open dropdowns/menus and open the expandMenu
    if ($(".topNav .expands.open").length < 1) {
      closeAllMenus();
      openExpandMenu(menu_link);
      $(".logoBox").addClass("open");
    } else {
      //one is open, check if its the same one what has been clicked or different - you can assume no other menus are open such as search etc
      //if same, close it
      if ($(".expandMenu#" + menu_link).hasClass("open")) {
        $(".logoBox").removeClass("open");
        closeExpandMenu();
      } else {
        //different menu, so close the old one and open the new
        closeExpandMenu();
        openExpandMenu(menu_link);
      }
    }
  });

  $(document).on("click", ".searchNavLink", function (e) {
    e.preventDefault();
    $(".searchLink").trigger("click");
  });

  //search menu
  $(document).on("click", ".searchLink", function (e) {
    e.preventDefault();
    var search_link = $(this);
    if (search_link.hasClass("open")) {
      closeSearchMenu();
    } else {
      closeAllMenus();
      openSearchMenu();
    }
  });

  //login menu
  $(document).on("click", ".loginLink", function (e) {
    //e.preventDefault();
    var login_link = $(this);
    if (login_link.hasClass("open")) {
      closeLoginMenu();
    } else {
      closeAllMenus();
      //openLoginMenu(); //test comment
    }
  });

  //sidebar overlay menu
  $(document).on("click", ".menuToggle", function (e) {
    e.preventDefault();
    var menu_link = $(this);
    if (menu_link.hasClass("open")) {
      //close menu
      closeAllMenus();
    } else {
      //open sidebar menu
      closeAllMenus();
      openSidebarMenu();
    }
  });

  //sidebar overlay menu links hover
  if ($(window).width() > 760) {
    $(".overlayNav li a").hover(
      function () {
        $(this).parent("li").siblings("li").children("a").addClass("notHover");
      },
      function () {
        $(".notHover").removeClass("notHover");
      },
    );

    //sidebar overlay menu links hover
    $(".secondaryNav li a").hover(
      function () {
        $(this).parent("li").siblings("li").children("a").addClass("notHover");
      },
      function () {
        $(".notHover").removeClass("notHover");
      },
    );
  }

  //sidebar overlay menu expand to second level
  $(document).on("click", ".overlayNav li.expands a", function (e) {
    e.preventDefault();
    //add active class to current link, remove it from any other active links, open the secondaryNav
    var clicked_link = $(this);
    var menu_link = clicked_link.data("link");
    $(".overlayNav li a").addClass("otherLinkClicked").removeClass("open");
    clicked_link.addClass("open").removeClass("otherLinkClicked");
    closeSecondaryMenu();
    openSecondaryMenu(menu_link);
  });

  //close secondary using back link on mobile
  $(document).on("click", ".secondaryNav li.backLink a", function (e) {
    e.preventDefault();
    closeSecondaryMenu();
    $(".overlayNav li a").removeClass("otherLinkClicked open");
  });

  //featured home slider
  var featuredSlider = $(".featuredSlider").slick({
    fade: true,
    dots: false,
    arrows: false,
    slide: ".slide",
  });

  $(document).on("click", ".featuredContent .arrows .prev", function (e) {
    e.preventDefault();
    featuredSlider.slick("slickPrev");
    startProgressbar();
  });

  $(document).on("click", ".featuredContent .arrows .next", function (e) {
    e.preventDefault();
    featuredSlider.slick("slickNext");
    startProgressbar();
  });

  featuredSlider.on("swipe", function (event, slick, direction) {
    startProgressbar();
  });

  var time = 2;
  var $bar,
    isPause = false,
    tick,
    percentTime;

  $bar = $(".slider-progress .progress");

  function startProgressbar() {
    resetProgressbar();
    percentTime = 0;
    //isPause = false;
    tick = setInterval(interval, 30);
  }

  function interval() {
    if (isPause === false) {
      percentTime += 1 / (time + 0.1);
      $bar.css({
        width: percentTime + "%",
      });
      if (percentTime >= 100) {
        featuredSlider.slick("slickNext");
        startProgressbar();
      }
    }
  }

  function resetProgressbar() {
    $bar.css({
      width: 0 + "%",
    });
    clearTimeout(tick);
  }

  $(".featuredSlider").hover(
    function () {
      isPause = true;
      //console.log('hovering');
    },
    function () {
      isPause = false; //change me back
      //console.log('not hovering');
    },
  );

  startProgressbar();

  //next event countdown clock
  if ($("#countdown").length) {
    //var deadline = new Date('Dec 11, 2017 14:00:00');
    var deadline = $("#countdown").data("date");
    initializeClock("countdown", deadline);
  }

  //accordion id's for cache
  var count = 1;
  $("button.accordion").each(function (e) {
    $(this).attr("id", "accordion_" + count);
    count++;
  });

  //accordions
  $(document).on("click", ".accordion", function (e) {
    var acc = $(this);
    var panel = acc.next(".panel");
    var h = panel.children(".inner").height() + 40;

    //console.log(h);

    //comment out the next if statement to close other accordions when opening a new one
    /*if(!acc.hasClass('active') && $('.accordion.active').length){
			$('.accordion.active').removeClass('active');
			$('.panel').css('max-height',0);
		}*/

    acc.toggleClass("active");

    if (!acc.hasClass(".dashboardNavAccordion")) {
      if (acc.hasClass("active")) {
        panel.css("max-height", h);
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
      //console.log('no accordion in cache');
    }
  }

  //if hash is in url and it matches an accordion, open it
  if (location.hash) {
    var hash = location.hash.replace("#", "");
    //console.log(hash);
    if ($(".accordion#" + hash).length) {
      //accordion exists, if its not open, open it
      if (!$(".accordion#" + hash).hasClass("active")) {
        $("#" + hash).trigger("click");
      }
    } else {
      console.log("no accordion with that id");
    }
  }

  //resources
  $(document).on("change", "select#category", function () {
    var val = $("select#category").val();
    var select = $("select#subcategory");

    if (val == "") {
      select.html("");
      select.html('<option class="label">Choose Sub Category</option>');
      select.prop("disabled", true);
      select.easyDropDown("destroy");
      select.easyDropDown();
    } else {
      url = "../php/ajax/getResourceSubCategories.php?parent_url=" + val;
      url = encodeURI(url);

      $.get(url, function (data) {
        select.html("");
        select.html(data);
        select.prop("disabled", false);
        select.easyDropDown("destroy");
        select.easyDropDown({
          cutOff: 6,
        });
        history.replaceState(
          "",
          "USA Archery Resource Center",
          "/resource-center/" + val,
        );
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

    if (category == "" && keyword == "") {
      $("#resource_results").html(
        '<tr class="titleRow"><td class="searchTitle" colspan="6"><h1>Please enter a keyword or select a category.</h1></td></tr>',
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
          "USA Archery Resource Center",
          "/resource-center/" + category + "/" + subcategory,
        );
      }
      //console.log(url);

      $.get(url, function (data) {
        $("#resource_results").html(data);
      });
    }
  });

  //on filter_news change, go to the url value of the selected option
  $(document).on("change", "#filter_news", function (e) {
    var filter = $("#filter_news").val();
    location.href = filter;
  });

  //on filter_news change, go to the url value of the selected option
  $(document).on("change", "#filter_date", function (e) {
    var filter = $("#filter_date").val();
    location.href = filter;
  });

  /*//news
  $(document).on("change", "#filter_news", function (e) {
    var filter = this.value;
    var select = $("#filter_date");
    var filter_date = select.val();
    var start = 0;
    var limit = 12;
    var button = $(".viewMoreNews");
    if (filter_date == "") {
      filter_date = "all";
    }

    //update date filter
    url =
      "../php/ajax/updateDateFilter.php?filter=" +
      filter +
      "&filter_date=" +
      filter_date;
    url = encodeURI(url);

    $.get(url, function (data) {
      select.easyDropDown("destroy");
      select.html(data);
      select.easyDropDown({
        cutOff: 6,
      });
    });

    //update articles
    url =
      "../php/ajax/filterNews.php?filter=" +
      filter +
      "&filter_date=" +
      filter_date +
      "&start=" +
      start +
      "&limit=" +
      limit;
    url = encodeURI(url);

    $.get(url, function (data) {
      $(".newsArticles").fadeOut(500);
      setTimeout(function () {
        button.parent().remove();
        $(".newsArticles").html("");
        $(".newsArticles").html(data);
      }, 500);
    }).done(function (data) {
      $(".newsArticles").fadeIn();
    });

    //history.replaceState('', 'USA Archery News', '/news/'+filter+'/'+filter_date);
  });

  $(document).on("change", "#filter_date", function (e) {
    var filter_date = this.value;
    var select = $("#filter_news");
    var filter = select.val();
    var start = 0;
    var limit = 12;
    var button = $(".viewMoreNews");
    if (filter == "") {
      filter = "all";
    }

    //update date filter
    url =
      "../php/ajax/updateCategoryFilter.php?filter=" +
      filter +
      "&filter_date=" +
      filter_date;
    url = encodeURI(url);

    $.get(url, function (data) {
      //console.log(data);return;
      select.easyDropDown("destroy");
      select.html(data);
      select.easyDropDown({
        cutOff: 6,
      });
    });

    //update articles
    url =
      "../php/ajax/filterNews.php?filter=" +
      filter +
      "&filter_date=" +
      filter_date +
      "&start=" +
      start +
      "&limit=" +
      limit;
    url = encodeURI(url);

    $.get(url, function (data) {
      $(".newsArticles").fadeOut(500);
      setTimeout(function () {
        button.parent().remove();
        $(".newsArticles").html("");
        $(".newsArticles").html(data);
      }, 500);
    }).done(function (data) {
      $(".newsArticles").fadeIn();
    });

    //history.replaceState('', 'USA Archery News', '/news/'+filter+'/'+filter_date);
  });

  $(document).on("click", ".viewMoreNews", function (e) {
    e.preventDefault();
    var button = $(this);
    var start = $("#start").val();
    var limit = $("#limit").val();
    var filter_date = $("#filter_date").val();
    var filter = $("#filter_news").val();
    if (filter == "" || filter == null) {
      filter = "all";
    }
    if (filter_date == "" || filter_date == null) {
      filter_date = "all";
    }

    //update articles
    url =
      "../php/ajax/filterNews.php?filter=" +
      filter +
      "&filter_date=" +
      filter_date +
      "&start=" +
      start +
      "&limit=" +
      limit;
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      //$('.newsArticles').fadeOut(500);
      button.parent().remove();
      $(".newsArticles").append(data);
    });

    $("#start").val(parseInt(start) + parseInt(limit));
  });*/

  //newsletter
  $(document).on("submit", "#signup_box", function (e) {
    e.preventDefault();
    var email = $("#email_signup").val();

    if (!isEmail(email)) {
      $(".signupResponse").html("Please enter a valid email.");
    } else {
      url = "../php/ajax/signupUser.php";
      url = encodeURI(url);

      post_data = {
        email: email,
      };

      $.post(url, post_data, function (data) {
        console.log(data);
        /*if(data=='success'){
					$('#signup_box .signupResponse').fadeOut('slow',function(){
						$('#signup_box')[0].reset();
						$('#signup_box .signupResponse').html('Thank you for signing up.');
						$('#signup_box .signupResponse').addClass('success');
						$('#signup_box .signupResponse').fadeIn('slow');
					});
				}else{
					$('#signup_box .signupResponse').fadeOut('slow',function(){
						$('#signup_box .signupResponse').html(data);
						$('#signup_box .signupResponse').fadeIn();
					});
				}*/
      });
    }
  });

  //filter events
  $(document).on(
    "submit",
    "#zipcode_search_events, #event_name_search_events",
    function (e) {
      e.preventDefault();
      $("#filter_events").trigger("click");
    },
  );

  $(document).on("click", ".filterEvents", function (e) {
    e.preventDefault();
    var level = $("select#level").val();
    var state = $("select#state").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();
    var event_name = $("#event_name").val();
    var page = 0;

    if (level == "") {
      level = 0;
    }

    if (state == "") {
      state = 0;
    }

    /*if(division == ''){
			division = 0;
		}*/

    if (zipcode == "") {
      distance = 0;
    }

    $("#events_calendar_table").html(
      '<tr class="titleRow"><td class="searchTitle" colspan="6"><h2>Loading...</h2></td></tr>',
    );

    url =
      "../php/ajax/filterEvents.php?level=" +
      level +
      "&state=" +
      state +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&event_name=" +
      event_name +
      "&page=" +
      page +
      "&run=true";
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".eventsCalendarTable").html(data);
      var hide = $("#hide").val();
      if (hide == "hide") {
        $(".loadMoreHolder").remove();
      }
    });
  });

  if ($("#events_calendar_table").length) {
    $("#filter_events").click();
  }

  $(document).on("click", ".loadMoreEvents", function (e) {
    e.preventDefault();
    var level = $("select#level").val();
    var state = $("select#state").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();
    var event_name = $("#event_name").val();

    if (level == "") {
      level = 0;
    }

    if (state == "") {
      state = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    var page = $(".loadMoreEvents").attr("data-page");

    //$('.loadMoreHolder').html('<h2 class="loadingTitle">Loading...</h2>');

    url =
      "../php/ajax/filterEvents.php?level=" +
      level +
      "&state=" +
      state +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&event_name=" +
      event_name +
      "&page=" +
      page +
      "&run=true";
    url = encodeURI(url);

    $.get(url, function (data) {
      $(".loadMoreHolder").remove();
      var data_split = data.split("~~~~~");
      console.log(data_split[0]);
      $("#events_calendar_table").append(data_split[0]);
      $(".eventsCalendarTable").append(data_split[1]);
    });
  });

  //load more marvel events
  $(document).on("click", ".loadMoreMarvelEvents", function (e) {
    e.preventDefault();
    var state = $("select#state").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();

    if (state == "") {
      state = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    var page = $(".loadMoreMarvelEvents").attr("data-page");

    //$('.loadMoreHolder').html('<h2 class="loadingTitle">Loading...</h2>');

    url =
      "../php/ajax/filterEventsMarvel.php?state=" +
      state +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&page=" +
      page +
      "&run=true";
    url = encodeURI(url);

    $.get(url, function (data) {
      $(".loadMoreHolder").remove();
      var data_split = data.split("~~~~~");
      console.log(data_split[0]);
      $(".finderWrapper .results").append(data_split[0]);
      $(".finderWrapper .results").append(data_split[1]);
    });
  });

  //filter clubs
  $(document).on(
    "submit",
    "#zipcode_search_clubs, #club_name_search_clubs",
    function (e) {
      e.preventDefault();
      $("#filter_clubs").trigger("click");
    },
  );

  $(document).on("click", ".filterClubs", function (e) {
    e.preventDefault();
    var club_type = $("select#club_type").val();
    var state = $("select#state").val();
    var club_name = $("#club_name").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();

    if (club_type == "") {
      club_type = 0;
    }

    if (state == "") {
      state = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    if (zipcode == "") {
      //showErrorPopup();
      //return false;
    }

    if (zipcode != "") {
      //if zipcode not blank, check if its valid format
      if (!isZip(zipcode)) {
        showErrorPopup();
        return false;
      }
    }

    $(".clubResultsHolder").html('<h2 class="loadingTitle">Loading...</h2>');

    url =
      "../php/ajax/filterClubs.php?club_type=" +
      club_type +
      "&state=" +
      state +
      "&club_name=" +
      club_name +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&run=true";
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".clubResultsHolder").html(data);
    });
  });

  $(document).on("click", ".loadMoreClubs", function (e) {
    e.preventDefault();
    var club_type = $("select#club_type").val();
    var state = $("select#state").val();
    var club_name = $("#club_name").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();

    if (club_type == "") {
      club_type = 0;
    }

    if (state == "") {
      state = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    /*if (zipcode != "") {
      //if zipcode not blank, check if its valid format
      if (!isZip(zipcode)) {
        showErrorPopup();
        return false;
      }
    }*/

    var page = $(".loadMoreClubs").attr("data-page");

    $(".loadMoreHolder").html('<h2 class="loadingTitle">Loading...</h2>');

    url =
      "../php/ajax/filterClubs.php?club_type=" +
      club_type +
      "&state=" +
      state +
      "&club_name=" +
      club_name +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&page=" +
      page +
      "&run=true";
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".loadMoreHolder").remove();
      $(".clubResultsHolder").append(data);
    });
  });

  //filter courses
  $(document).on("submit", "#zipcode_search_courses", function (e) {
    e.preventDefault();
    $("#filter_courses").trigger("click");
  });

  $(document).on("click", ".filterCourses", function (e) {
    e.preventDefault();
    var level = $("select#level").val();
    var state = $("select#state").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();
    var type = $("#type").val();

    if (state == "") {
      state = 0;
    }

    if (level == "") {
      level = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    if (zipcode == "") {
      //showErrorPopup();
      //return false;
    }

    $("#course_calendar_table").html(
      '<tr class="titleRow"><td class="searchTitle" colspan="6"><h2>Loading...</h2></td></tr>',
    );

    url =
      "../php/ajax/filterCourses.php?level=" +
      level +
      "&state=" +
      state +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&run=true&type=" +
      type;
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".courseCalendarTable").html(data);
      var hide = $("#hide").val();
      if (hide == "hide") {
        $(".loadMoreHolder").remove();
      }
    });
  });

  $(document).on("click", ".filterCoursesOnline", function (e) {
    e.preventDefault();
    var level = $("select#level").val();
    var state = $("select#state").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();
    var type = $("#type").val();

    if (state == "") {
      state = 0;
    }

    if (level == "") {
      level = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    if (zipcode == "") {
      //showErrorPopup();
      //return false;
    }

    $("#course_calendar_table").html(
      '<tr class="titleRow"><td class="searchTitle" colspan="6"><h2>Loading...</h2></td></tr>',
    );

    url =
      "../php/ajax/filterCoursesOnline.php?level=" +
      level +
      "&state=" +
      state +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&run=true&type=" +
      type;
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".courseCalendarTable").html(data);
      var hide = $("#hide").val();
      if (hide == "hide") {
        $(".loadMoreHolder").remove();
      }
    });
  });

  if ($("#course_calendar_table").length) {
    //$('#filter_courses').click();
  }

  $(document).on("click", ".loadMoreCourses", function (e) {
    e.preventDefault();
    var level = $("select#level").val();
    var state = $("select#state").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();
    var type = $("#type").val();

    if (level == "") {
      level = 0;
    }

    if (state == "") {
      state = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    var page = $(".loadMoreCourses").attr("data-page");

    //$('.loadMoreHolder').html('<h2 class="loadingTitle">Loading...</h2>');

    url =
      "../php/ajax/filterCourses.php?level=" +
      level +
      "&state=" +
      state +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&page=" +
      page +
      "&run=true&type=" +
      type;
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".loadMoreHolder").remove();
      var data_split = data.split("~~~~~");
      //console.log(data_split[1]);
      $("#course_calendar_table").append(data_split[0]);
      $(".courseCalendarTable").append(data_split[1]);
    });
  });

  $(document).on("click", ".loadMoreCoursesOnline", function (e) {
    e.preventDefault();
    var level = $("select#level").val();
    var state = $("select#state").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();
    var type = $("#type").val();

    if (level == "") {
      level = 0;
    }

    if (state == "") {
      state = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    var page = $(".loadMoreCoursesOnline").attr("data-page");

    //$('.loadMoreHolder').html('<h2 class="loadingTitle">Loading...</h2>');

    url =
      "../php/ajax/filterCoursesOnline.php?level=" +
      level +
      "&state=" +
      state +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&page=" +
      page +
      "&run=true&type=" +
      type;
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".loadMoreHolder").remove();
      var data_split = data.split("~~~~~");
      //console.log(data_split[1]);
      $("#course_calendar_table").append(data_split[0]);
      $(".courseCalendarTable").append(data_split[1]);
    });
  });

  //filter coaches
  $(document).on("submit", "#coach_name_search_coaches", function (e) {
    e.preventDefault();
    $("#filter_coaches").trigger("click");
  });

  $(document).on("submit", "#zipcode_search_coaches", function (e) {
    e.preventDefault();
    $("#filter_coaches").trigger("click");
  });

  $(document).on("click", ".filterCoaches", function (e) {
    e.preventDefault();
    var coach_type = $("select#coach_type").val();
    var state = $("select#state").val();
    var coach_name = $("#coach_name").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();

    if (coach_type == "") {
      coach_type = 0;
    }

    if (state == "") {
      state = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    if (zipcode == "") {
      //showErrorPopup();
      //return false;
    }

    $(".coachResultsHolder").html('<h2 class="loadingTitle">Loading...</h2>');

    url =
      "../php/ajax/filterCoaches.php?coach_type=" +
      coach_type +
      "&state=" +
      state +
      "&coach_name=" +
      coach_name +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&run=true";
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".coachResultsHolder").html(data);
    });
  });

  $(document).on("click", ".loadMoreCoaches", function (e) {
    e.preventDefault();
    var coach_type = $("select#coach_type").val();
    var state = $("select#state").val();
    var coach_name = $("#coach_name").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();

    if (coach_type == "") {
      coach_type = 0;
    }

    if (state == "") {
      state = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    var page = $(".loadMoreCoaches").attr("data-page");

    $(".loadMoreHolder").html('<h2 class="loadingTitle">Loading...</h2>');

    url =
      "../php/ajax/filterCoaches.php?coach_type=" +
      coach_type +
      "&state=" +
      state +
      "&coach_name=" +
      coach_name +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&page=" +
      page +
      "&run=true";
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".loadMoreHolder").remove();
      $(".coachResultsHolder").append(data);
    });
  });

  //filter judges
  $(document).on("submit", "#judge_name_search_judges", function (e) {
    e.preventDefault();
    $("#filter_judges").trigger("click");
  });

  $(document).on("submit", "#zipcode_search_judges", function (e) {
    e.preventDefault();
    $("#filter_judges").trigger("click");
  });

  $(document).on("click", ".filterJudges", function (e) {
    e.preventDefault();
    var judge_type = $("select#judge_type").val();
    var state = $("select#state").val();
    var judge_name = $("#judge_name").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();

    if (judge_type == "") {
      judge_type = 0;
    }

    if (state == "") {
      state = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    if (zipcode == "") {
      //showErrorPopup();
      //return false;
    }

    $(".judgeResultsHolder").html('<h2 class="loadingTitle">Loading...</h2>');

    url =
      "../php/ajax/filterJudges.php?judge_type=" +
      judge_type +
      "&state=" +
      state +
      "&judge_name=" +
      judge_name +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&run=true";
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".judgeResultsHolder").html(data);
    });
  });

  $(document).on("click", ".loadMoreJudges", function (e) {
    e.preventDefault();
    var judge_type = $("select#judge_type").val();
    var state = $("select#state").val();
    var judge_name = $("#judge_name").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();

    if (judge_type == "") {
      judge_type = 0;
    }

    if (state == "") {
      state = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    var page = $(".loadMoreJudges").attr("data-page");

    $(".loadMoreHolder").html('<h2 class="loadingTitle">Loading...</h2>');

    url =
      "../php/ajax/filterJudges.php?judge_type=" +
      judge_type +
      "&state=" +
      state +
      "&judge_name=" +
      judge_name +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&page=" +
      page +
      "&run=true";
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".loadMoreHolder").remove();
      $(".judgeResultsHolder").append(data);
    });
  });

  //filter camps
  $(document).on("submit", "#zipcode_search_camps", function (e) {
    e.preventDefault();
    $("#filter_camps").trigger("click");
  });

  $(document).on("click", ".filterCamps", function (e) {
    e.preventDefault();
    var level = $("select#level").val();
    var state = $("select#state").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();

    if (state == "") {
      state = 0;
    }

    if (level == "") {
      level = 0;
    }

    if (zipcode == "") {
      distance = 0;
    }

    $("#camps_calendar_table").html(
      '<tr class="titleRow"><td class="searchTitle" colspan="6"><h2>Loading...</h2></td></tr>',
    );

    url =
      "../php/ajax/filterCamps.php?level=" +
      level +
      "&state=" +
      state +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&run=true";
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $("#camps_calendar_table").html(data);
    });
  });

  //tabs - donate
  $(document).on("click", ".tabLink", function (e) {
    e.preventDefault();
    var id = $(this).data("id");
    $(".tabLink.active").removeClass("active");
    $(this).addClass("active");
    $(".tabContent.active").removeClass("active");
    $(".tabContent#" + id).addClass("active");
  });

  //judge feedback form
  $(document).on("submit", "#feedback_form_judges", function (e) {
    e.preventDefault();
    var valid = true;

    var email = $("#feedback_form_judges #email").val();
    var name = $("#feedback_form_judges #name").val();
    var feedback = $("#feedback_form_judges #feedback").val();
    var event_name = $("#feedback_form_judges #event_name").val();
    var judge_name = $("#feedback_form_judges #judge_name").val();

    /*if(name == ''){
      $('#feedback_form_judges .response').html('Please enter a valid name.');
      valid = false;
      return;
    }

    if(!isEmail(email)){
      $('#feedback_form_judges .response').html('Please enter a valid email.');
      valid = false;
      return;
    }*/

    if (event_name == "") {
      $("#feedback_form_judges .response").html(
        "Please enter a valid event name.",
      );
      valid = false;
      return;
    }

    if (judge_name == "") {
      $("#feedback_form_judges .response").html(
        "Please enter a valid judge name.",
      );
      valid = false;
      return;
    }

    if (feedback == "") {
      $("#feedback_form_judges .response").html("Please enter some feedback.");
      valid = false;
      return;
    }

    var anon;
    var isAnon = $("#anon").is(":checked");
    if (isAnon) {
      anon = "Yes";
    } else {
      anon = "No";
    }

    if (valid) {
      $("#feedback_form_judges button").prop("disabled", true);

      url = "../php/ajax/sendFeedbackFormJudges.php";
      url = encodeURI(url);

      post_data = {
        email: email,
        name: name,
        judge_name: judge_name,
        event_name: event_name,
        feedback: feedback,
        anon: anon,
      };

      $.post(url, post_data, function (data) {
        if (data == "success") {
          $("#feedback_form_judges")[0].reset();
          $("#feedback_form_judges .response").html(
            "Thank you for sending feedback.",
          );
          $("#feedback_form_judges .response").addClass("success");
          $("#feedback_form_judges button").prop("disabled", false);
        } else {
          $("#feedback_form_judges .response").html(data);
          $("#feedback_form_judges button").prop("disabled", false);
        }
      });
    }
  });

  //report concern form
  $(document).on("submit", "#report_concern_form", function (e) {
    e.preventDefault();
    var valid = true;

    //name, email, phone, relation, victim_name, victim_email, victim_phone, reported_name, reported_position, anyone_else, place, checkboxes, report, anon

    var name = $("#report_concern_form #name").val();
    var email = $("#report_concern_form #email").val();
    var phone = $("#report_concern_form #phone").val();
    var relation = $("#report_concern_form #relation").val();
    var victim_name = $("#report_concern_form #victim_name").val();
    var victim_email = $("#report_concern_form #victim_email").val();
    var victim_phone = $("#report_concern_form #victim_phone").val();
    var reported_name = $("#report_concern_form #reported_name").val();
    var reported_position = $("#report_concern_form #reported_position").val();
    var anyone_else = $("#report_concern_form #anyone_else").val();
    var place = $("#report_concern_form #place").val();
    var report = $("#report_concern_form #report").val();

    /*if(name == ''){
	  $('#feedback_form_judges .response').html('Please enter a valid name.');
	  valid = false;
	  return;
	}

	if(!isEmail(email)){
	  $('#feedback_form_judges .response').html('Please enter a valid email.');
	  valid = false;
	  return;
	}*/

    if (
      $("#report_concern_form .checkboxes input[type=checkbox]:checked")
        .length == 0
    ) {
      $("#report_concern_form .response").html(
        "Please select at least one checkbox above for the type of misconduct you are reporting.",
      );
      valid = false;
      return;
    } else {
      var types = "";
      $("#report_concern_form .checkboxes input[type=checkbox]:checked").each(
        function (i) {
          types += $(this).val() + ", ";
        },
      );
    }

    if (report == "") {
      $("#report_concern_form .response").html(
        "Please enter some details of the incident.",
      );
      valid = false;
      return;
    }

    var anon;
    var isAnon = $("#anon").is(":checked");
    if (isAnon) {
      anon = "Yes";
    } else {
      anon = "No";
    }

    if (valid) {
      $("#report_concern_form button").prop("disabled", true);

      url = "../php/ajax/sendReportConcernForm.php";
      url = encodeURI(url);

      post_data = {
        email: email,
        name: name,
        phone: phone,
        report: report,
        anon: anon,
        types: types,
        relation: relation,
        victim_name: victim_name,
        victim_email: victim_email,
        victim_phone: victim_phone,
        reported_name: reported_name,
        reported_position: reported_position,
        anyone_else: anyone_else,
        place: place,
      };

      $.post(url, post_data, function (data) {
        if (data == "success") {
          $("#report_concern_form")[0].reset();
          $("#report_concern_form .response").html(
            "Thank you for submitting your report.",
          );
          $("#report_concern_form .response").addClass("success");
          $("#report_concern_form button").prop("disabled", false);
        } else {
          $("#report_concern_form .response").html(data);
          $("#report_concern_form button").prop("disabled", false);
        }
      });
    }
  });

  var copySlider = $(".copySlider")
    .slick({
      fade: true,
      arrows: true,
      speed: 1000,
      pauseOnHover: false,
      slide: ".copySlider .oneSlide",
      dots: true,
      dotsClass: "slider-paging-number",
      customPaging: function (slick) {
        return slick.currentSlide + 1 + "/" + slick.slideCount;
      },
    })
    .on("afterChange", function (event, slick, currentSlide) {
      $(this)
        .find('*[role="tablist"]')
        .find("li")
        .eq(0)
        .text(slick.options.customPaging.call(this, slick, currentSlide));
    });

  $(document).on("click", ".copySlider a.nextSlide", function (e) {
    e.preventDefault();
    copySlider.slick("slickNext");
  });

  //updated 2022
  if ($(".age-calculator").length) {
    var birth = $("#birth");
    var age = $("#age");
    var current = $("#current");
    var $els = $("#current, #birth");
    $els.change(function () {
      var total = current.val() - birth.val();
      $("#text").show();
      $("#age").text(total);
      $("#cyear").text($(current).val());
      if (90 >= total) {
        $("#total").text("70+");
      }
      if (total >= 70 && total <= 89) {
        $("#total").text("70+");
      }
      if (total >= 60 && total <= 69) {
        $("#total").text("60+");
      }
      if (total >= 50 && total <= 59) {
        $("#total").text("50+");
      }
      if (total >= 21 && total <= 49) {
        $("#total").text("Senior");
      }
      if (total >= 18 && total <= 20) {
        $("#total").text("U21");
      }
      if (total >= 15 && total <= 17) {
        $("#total").text("U18");
      }
      if (total >= 11 && total <= 14) {
        $("#total").text("U15");
      }
      if (total >= 10 && total <= 12) {
        $("#total").text("U13");
      }
      if (total >= 0 && total <= 9) {
        $("#total").text("Yeoman");
      }
      if (total <= 0) {
        $("#total").text("you are not born yet...");
      }
    });
  }

  $(document).on("click", ".finderWrapper .results .oneResult", function (e) {
    //console.log(e.target.parentElement);
    if (
      e.target.tagName.toLowerCase() !== "a" &&
      e.target.parentElement.tagName.toLowerCase() !== "a"
    ) {
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
        "&size=640x640" +
        "&scale=2" +
        "&markers=icon:https://usaarchery.93ft.com/images/icons/marker-grey.svg%7C" +
        lat +
        "," +
        lng +
        "&&style=feature:road.arterial%7Celement:geometry.fill%7Ccolor:0xffffff%7Cgamma:0.62&style=feature:landscape.man_made%7Celement:geometry%7Ccolor:0xe3dbc2&style=feature:landscape.natural%7Celement:geometry%7Ccolor:0xe5dfcd&style=feature:landscape.natural.terrain%7Celement:geometry%7Cvisibility:on&style=feature:poi%7Celement:labels%7Cvisibility:off&style=feature:poi.business%7Celement:all%7Cvisibility:off&style=feature:poi.medical%7Celement:geometry%7Ccolor:0xfbd3da&style=feature:poi.park%7Celement:geometry%7Ccolor:0xbde6ab&style=feature:road%7Celement:geometry.stroke%7Cvisibility:on&style=feature:road%7Celement:labels%7Cvisibility:on&style=feature:road.highway%7Celement:geometry.fill%7Ccolor:0xf7eecc&style=feature:road.highway%7Celement:geometry.stroke%7Ccolor:0xefd151&style=feature:road.local%7Celement:geometry.fill%7Ccolor:0x000&style=feature:transit.station.airport%7Celement:geometry.fill%7Ccolor:0xe9e9e9&style=feature:water%7Celement:geometry%7Ccolor:0x89bad1%7C" +
        "&key=AIzaSyAWlgD6KzTCvJbs6GxUf2E10MBQr_NuMHY')",
    );
    $(".finderWrapper .results .oneResult.active").removeClass("active");
    chosen.addClass("active");
  });

  //filter marvel events
  $(document).on("submit", "#zipcode_search_events_marvel", function (e) {
    e.preventDefault();
    $("#filter_events_marvel").trigger("click");
  });

  $(document).on("click", ".filterEventsMarvel", function (e) {
    e.preventDefault();
    var state = $("select#state").val();
    var distance = $("select#distance").val();
    var zipcode = $("#zipcode").val();
    var page = 0;

    if (state == "") {
      state = 0;
    }

    if (zipcode == "") {
      distance = 0;
    } else if (distance == "") {
      distance = "500";
    }

    //console.log(distance);
    //return;

    /*$("#events_calendar_table").html(
      '<tr class="titleRow"><td class="searchTitle" colspan="6"><h2>Loading...</h2></td></tr>'
    );*/

    $(".marvelFinderContent .finderWrapper").html(
      "<div class='results noResults'><h2>Loading...</h2></div>",
    );

    url =
      "../php/ajax/filterEventsMarvel.php?state=" +
      state +
      "&distance=" +
      distance +
      "&zipcode=" +
      zipcode +
      "&page=" +
      page +
      "&run=true";
    url = encodeURI(url);

    //console.log(url);

    $.get(url, function (data) {
      $(".marvelFinderContent .finderWrapper").html(data);
    });
  });

  $(document).on("click", "td.copyLink a", function (e) {
    e.preventDefault();
    var anchor = $(this);
    var link = anchor.attr("href");

    copyToClipboard(link);
    //change .tooltip text to copied
    anchor.find(".tooltip").text("Copied!");

    //anchor.css("opacity", "0.6");
    setTimeout(function () {
      //anchor.css("opacity", "1");
      anchor.find(".tooltip").text("Copy Link");
    }, 1000);
  });

  $(".countdown").each(function () {
    var countdown = $(this);
    var target = new Date(countdown.data("target")).getTime();

    // Helper function to wrap every single digit in a span
    function formatDigitSpans(num, minDigits) {
      var str = String(num);
      while (str.length < minDigits) {
        str = "0" + str;
      }
      return str
        .split("")
        .map(function (digit) {
          return '<span class="digit-box">' + digit + "</span>";
        })
        .join("");
    }

    function updateTimer() {
      var current = new Date().getTime();
      var diff = target - current;

      if (diff > 0) {
        var days = Math.floor(diff / (1000 * 60 * 60 * 24));
        var hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        var minutes = Math.floor((diff / 1000 / 60) % 60);
        var seconds = Math.floor((diff / 1000) % 60);

        // Scope updates using .html() and split digit spans
        // Days uses minimum 3 digits (or adjust to 2 if needed), others use 2
        countdown.find(".days .digits").html(formatDigitSpans(days, 3));
        countdown.find(".hours .digits").html(formatDigitSpans(hours, 2));
        countdown.find(".minutes .digits").html(formatDigitSpans(minutes, 2));
        countdown.find(".seconds .digits").html(formatDigitSpans(seconds, 2));
      } else {
        clearInterval(timer);
      }
    }

    // Run immediately so there's no 1-second initial lag
    updateTimer();

    // Repeat every second
    var timer = setInterval(updateTimer, 1000);
  });
});
//*-*-*-*-*-*-*-*-*-*-*-*
//   END OF DOM READY
//*-*-*-*-*-*-*-*-*-*-*-*

$(window).on("load", function () {
  if ($(".mapHolder").length) {
    loadScript();
  }
});

$(window).scroll(function () {
  clearTimeout($.data(this, "scrollTimer"));
  $.data(
    this,
    "scrollTimer",
    setTimeout(function () {
      positionNav();
    }, 25),
  );

  var windowBottom = $(this).scrollTop() + $(this).innerHeight();
});

function positionNav() {
  var pos = $(document).scrollTop();
  var logo = $(".logoBox");
  if (pos > 36) {
    logo.addClass("shorterScroll");
  } else {
    logo.removeClass("shorterScroll");
  }
}

function isEmail(email) {
  var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  return regex.test(email);
}

function isZip(zip) {
  var regex = /^\d{5}(?:[-\s]\d{4})?$/;
  return regex.test(zip);
}

function openExpandMenu(link) {
  $(".expandMenu#" + link).addClass("open");
  $('.topNav .expands[data-link="' + link + '"]').addClass("open");
}

function closeExpandMenu(link) {
  if (!link) {
    link = "";
  } else {
    link = "#" + link;
  }
  $(".topNav .expands.open").removeClass("open");
  $(".expandMenu" + link).removeClass("open");
}

function openSearchMenu() {
  $(".searchMenu, .searchLink").addClass("open");
}

function closeSearchMenu() {
  $(".searchMenu, .searchLink").removeClass("open");
}

function openLoginMenu() {
  $(".loginMenu, .loginLink").addClass("open");
}

function closeLoginMenu() {
  $(".loginMenu, .loginLink").removeClass("open");
}

function openSidebarMenu() {
  $(".topI").addClass("topAnimate");
  $(".midI").addClass("midAnimate");
  $(".bottomI").addClass("bottomAnimate");
  $(".menuToggle, .overlayNav").addClass("open");
}

function closeSidebarMenu() {
  $(".topI").removeClass("topAnimate");
  $(".midI").removeClass("midAnimate");
  $(".bottomI").removeClass("bottomAnimate");
  $(".menuToggle, .overlayNav, .secondaryNav").removeClass("open");
  $(".overlayNav li a").removeClass("otherLinkClicked open");
}

function openSecondaryMenu(link) {
  $(".secondaryNav#" + link).addClass("open");
}

function closeSecondaryMenu() {
  $(".secondaryNav").removeClass("open");
}

function closeAllMenus() {
  closeSearchMenu();
  closeExpandMenu();
  closeLoginMenu();
  closeSidebarMenu();
  $(".logoBox").removeClass("open");
}

function getTimeRemaining(endtime) {
  var t = Date.parse(endtime) - Date.parse(new Date());
  var seconds = Math.floor((t / 1000) % 60);
  var minutes = Math.floor((t / 1000 / 60) % 60);
  var hours = Math.floor((t / (1000 * 60 * 60)) % 24);
  var days = Math.floor(t / (1000 * 60 * 60 * 24));

  //console.log(t);
  if (t <= 0) {
    t = 0;
    days = 0;
    hours = 0;
    minutes = 0;
    seconds = 0;
  }

  return {
    total: t,
    days: days,
    hours: hours,
    minutes: minutes,
    seconds: seconds,
  };
}

function initializeClock(id, endtime) {
  var days;
  var clock = document.getElementById(id);
  var daysSpan = clock.querySelector(".days");
  var hoursSpan = clock.querySelector(".hours");
  var minutesSpan = clock.querySelector(".minutes");
  var secondsSpan = clock.querySelector(".seconds");

  function updateClock() {
    var t = getTimeRemaining(endtime);

    if (t.days < 10) {
      days = "0" + t.days;
    } else {
      days = t.days;
    }

    daysSpan.innerHTML = days;
    hoursSpan.innerHTML = ("0" + t.hours).slice(-2);
    minutesSpan.innerHTML = ("0" + t.minutes).slice(-2);
    secondsSpan.innerHTML = ("0" + t.seconds).slice(-2);

    //console.log(t.total);

    if (t.total <= 0) {
      clearInterval(timeinterval);
      $(".time").html("HAPPENING NOW");
    }
  }

  updateClock();
  var timeinterval = setInterval(updateClock, 1000);
}

function pad(str, max) {
  str = str.toString();
  return str.length < max ? pad("0" + str, max) : str;
}

//google maps
function loadScript() {
  var script = document.createElement("script");
  script.type = "text/javascript";
  script.src =
    "https://maps.googleapis.com/maps/api/js?key=AIzaSyBcQ0bPAj_pyVwOd21bcJaKkkvUCiW1ahE&callback=initialize";
  document.body.appendChild(script);
}

function initialize() {
  var map;
  var location;

  //var image = new google.maps.MarkerImage("/images/stamp.svg", null, null, null, new google.maps.Size(70, 70));

  var lat = $("#lat").val();
  var lng = $("#lng").val();

  location = new google.maps.LatLng(lat, lng);

  var mapOptions = {
    zoom: 15,
    center: location,
    scrollwheel: false,
  };

  map = new google.maps.Map(document.getElementById("map"), mapOptions);

  var marker = new google.maps.Marker({
    position: location,
    map: map,
  });
}

//cookies
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

//popups
function showErrorPopup() {
  $(".errorPopupOverlay").addClass("active");
}
function closeErrorPopup() {
  $(".errorPopupOverlay").removeClass("active");
}

//clipboard
function copyToClipboard(textToCopy) {
  // Create a "hidden" input
  var aux = document.createElement("input");

  // Assign it the value of the specified element
  aux.setAttribute("value", textToCopy);

  // Append it to the body
  document.body.appendChild(aux);

  // Highlight its content
  aux.select();

  // Copy the highlighted text
  document.execCommand("copy");

  // Remove it from the body
  document.body.removeChild(aux);
}
