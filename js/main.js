/**
 * File: main.js
 * Author: Justin Sena
 * Date: 2024-10-03
 * Activity 6 for Geog 575 at University of Wisconsin Madison, Fall 2024
 */

//global variables needed across functions
var map;
var dataStats = {};
var differences;
var useDifferenceColors = false;


//Create the Leaflet map and establish the styles
function createMap() {
    console.log("function createMap started")
    map = L.map('map', {
        center: [8, 12],
        zoom: 2
    });

    //add basemap tilelayer. Used Thunderforest.neighbourhood
    var Thunderforest_Neighbourhood = L.tileLayer('https://{s}.tile.thunderforest.com/neighbourhood/{z}/{x}/{y}.png?apikey={apikey}', {
        attribution: '© <a href="http://www.thunderforest.com/">Thunderforest</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        apikey: '9378b71f4e404a3793c0f56478f7f04c', //dude, don't look at my api key
        maxZoom: 5
    }).addTo(map);

    //call getData function from within Map
    getData(map);
};

//getData, AJAX Call, loads the data in the first .then, 
//and parses the data to the four functions in the second .then
function getData(){
    console.log("function getData started")
    //load the data, loads the birth rates geojson.
    fetch("data/BirthRates.geojson")
        .then(function(response){
            return response.json();
        })
        .then(function(json){
            //pass the data to the functions that utilize it, establish variables within scope where needed.
            var years = createYearsArray(json);
            minValue = calcStats(json);
            createPropSymbols(json, years);
            var averages = calculateAverages(json, years);
            differences = calculateDifferences(json, averages, years);
            createSequenceControls(years, averages);
            createLegend(years, averages);
            addToggleCheckbox(map, differences, years);            
        })
};

//creates an array of the years in the json for sequencing through
function createYearsArray(data) {
    console.log("function createYearsArray started")
    var years = []; //instantiate empty array
    var properties = data.features[0].properties;

    for (var attribute in properties) {
        // Check if the attribute matches the year format (e.g., "1985 [YR1985]")
        if (/\d{4} \[YR\d{4}\]/.test(attribute)) {
            years.push(attribute);//adds the year value in it's original format to the years array
        }
    }
    console.log("Years array: " + years)//debug to see the years array being built correctly
    return years;
};

//function to create an array of all values within the geoJSON
function calcStats(data) {
    console.log("function calcStats started"); //debug
    // Create empty array to store all data values
    var allValues = [];
    console.log("array allValues created"); //debug
    // Loop through each feature (country)
    for (var country of data.features) {
        // Loop through each year in the properties
        for (var attribute in country.properties) {
            // Check if the attribute matches the year format (e.g., "1985 [YR1985]")
            if (/\d{4} \[YR\d{4}\]/.test(attribute)) {
                // Get population value for the current year
                var value = country.properties[attribute];
                // Add value to array if it's a number
                if (!isNaN(value)) { //debug measure
                    allValues.push(value);
                }
            }
        }
    }
    console.log("allValues array: " + allValues); //debug
    // Update global dataStats object
    dataStats.min = Math.min(...allValues); //calc the min value from allValues array
    dataStats.max = Math.max(...allValues); //calc the max value frp, allValues array
    // Calc mean value from allValues array
    var sum = allValues.reduce(function(a, b) { return a + b; }, 0);
    dataStats.mean = sum / allValues.length;
    console.log("dataStats: ", dataStats); //debug
    return dataStats.min; //Return the minimum value
};

//Add a Leaflet layer built from the GeoJSON points and add it to the map.
function createPropSymbols(data, years){
    console.log("createPropSymbols started"); //debug
    var geoJsonLayer = L.geoJson(data, {        
        pointToLayer: function(feature, latlng){
            return pointToLayer(feature, latlng, years);//call pointToLayer function
        }
        
    }).addTo(map);
    console.log("Symbols added to map.\n\n\n\n\n") //debug, prints after all points added
};

//debugging, tracking process in console
function logCheck(countryName) {
    console.log("Processing country: " + countryName);
};

function pointToLayer(feature, latlng, years) {
    var countryName = feature.properties["Country Name"];
    logCheck(countryName); //debug

    //Use the first position array value, the first year in the dataset (1985) but if the data were to change, using the position is more flexible than the specific year.
    var attribute = years[0];

    //set the primary marker options
    var geojsonMarkerOptions = {
        fillColor: "#F47821",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
    };

    //For each feature, determine its value for the selected attribute
    var attValue = Number(feature.properties[attribute]);

    //Give each feature's circle marker a radius based on its attribute value
    //call caldPropRadius to run the Flannery Formula to get a radius dependent upon year indicated
    geojsonMarkerOptions.radius = calcPropRadius(attValue); 

    //create circle markers
    var layer = L.circleMarker(latlng, geojsonMarkerOptions);

    //hover tooltip shows country name when cursor hovers over the marker
    layer.bindTooltip(countryName, {
        permanent: false, //Tooltip will go away after hover ends
        sticky: true, //sticky moves the tooltip with the cursor
        direction: 'top', //Position the tooltip above the cursor
        className: 'country-tooltip' //Optional: Add a custom class for styling
    });

    //event listener to close tooltip upon click so that only the popup is open
    layer.on('click', function() {
        layer.closeTooltip();
    });

    //build popup content string for popups before a sequencer is used
    var popupContent = "<p><b>Country:</b> " + feature.properties["Country Name"] + "</p>";

    // Check if the feature has properties
    if (feature.properties) {
        var year = attribute.split(" ")[0]; // Extract the year only from the feature format ("1985 [YR1985]")

        // Write the year, the birth rate, and some text to the popup
        popupContent += "<p><b>Crude birth rate in " + year + ": </b>" + feature.properties[attribute] + "</p>";
    };
    
    // Bind the popup to the circle marker
    layer.bindPopup(popupContent, {
        offset: new L.Point(0, -geojsonMarkerOptions.radius) //offsets the popup so as not to block the marker
    });

    // Return the circle marker to the L.geoJson pointToLayer option
    console.log("pointToLayer finished");
    return layer;
};

//calculate the radius of each proportional symbol using Flannery Appearance Compensation formula
function calcPropRadius(attValue) {
    var minRadius = minValue/1.5;
    var radius = 1.3083 * Math.pow(attValue/minValue,0.5715) * minRadius
    return radius;      
};

// Function creates the slider and button sequence controls
function createSequenceControls(years, averages) {
    console.log("createSequenceControls started");
    var SequenceControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },

        onAdd: function() {
            // Create the control container HTML div
            var container = L.DomUtil.create('div', 'sequence-control-container');

            // Create range input element (slider)
            container.insertAdjacentHTML('beforeend', '<input class="range-slider" type="range">');

            // Add skip buttons
            container.insertAdjacentHTML('beforeend', '<button class="step" id="reverse" title="Reverse"><img src="img/noun-left-arrow-4163466.png"></button>'); 
            container.insertAdjacentHTML('beforeend', '<button class="step" id="forward" title="Forward"><img src="img/noun-right-arrow-4163821.png"></button>');

            // Add a label to display the current year
            container.insertAdjacentHTML('beforeend', '<div class="slider-label"><span id="current-year">' + years[0].match(/\d{4}/)[0] + '</span></div>');

            // Disable any map interaction clicking over the container space
            L.DomEvent.disableClickPropagation(container);

            // Set slider attributes
            var slider = container.querySelector(".range-slider");
            slider.max = years.length - 1; // The highest the slider can go
            slider.value = 0; // The starting point of the slider
            slider.step = 1; // Increments the slider moves in

            // Input listener for slider
            slider.addEventListener('input', function() {
                var index = this.value;
                console.log("Slider moved to index position: " + index); // Debug to see that slider works
                 // Change the prop symbol as you sequeunce
                updatePropSymbols(years[index]);
                 // Update the year label in the sequence container
                document.getElementById('current-year').textContent = years[index].match(/\d{4}/)[0];
                // Update the legend text with the sequence year and yearMean circle
                updateLegend(years[index], averages); 
                // Update the legend colors based on the current yearMeanCircle radius
                updateLegendColors(); 
            });

            // Click listener for buttons
            container.querySelectorAll('.step').forEach(function(step) {
                step.addEventListener("click", function() {
                    // Moves index based on slider value in case you already changed it with the slider
                    var index = slider.value; // Make sure the buttons change the index based on the position of the slider if it has been used

                    // Increment or decrement the index value depending on which button is clicked
                    if (step.id == 'forward') {
                        index++;
                        index = index > years.length - 1 ? 0 : index;
                        console.log("Forward button clicked, new index: " + index);
                    } else if (step.id == 'reverse') {
                        index--;
                        index = index < 0 ? years.length - 1 : index;
                        console.log("Reverse button clicked, new index: " + index);
                    }

                    // Update slider to move the thumb to the new index position
                    slider.value = index;

                    //Change the prop symbol as you sequeunce
                    updatePropSymbols(years[index]);

                    // Update the year label in the sequence container
                    document.getElementById('current-year').textContent = years[index].match(/\d{4}/)[0];
                    // Update the legend text with the sequence year and yearMean circle
                    updateLegend(years[index], averages);
                    // Update the legend colors based on the current yearMeanCircle radius
                    updateLegendColors(); 
                });
            });
            console.log("Sequence controls created.\n\n\n\n\n") //debug
            return container;
        }
    });

    map.addControl(new SequenceControl()); //add the sequence controls to the map
};

// add the temporal legend, yearMean circle and toggled items
function createLegend(attributes, averages) {
    console.log("createLegend started.");//debug
    var LegendControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },

        onAdd: function () {
            // Create the container class for styling
            var container = L.DomUtil.create('div', 'legend-container');

            //------------------------------------------------------
            // Current Year Mean Circle
            //------------------------------------------------------

            // Create a separate SVG for the yearMean circle
            var yearMeanSvg = '<svg id="yearMean-legend">';
            var yearMeanRadius = calcPropRadius(averages[attributes[0]]);
            var fixedBottom = 70; // Fixed bottom position for the circle
            var yearMeanCy = fixedBottom - yearMeanRadius;
            var yearMeanCx = 157;

            // SVG for yellow circle
            yearMeanSvg += '<circle class="legend-circle" id="yearMean" r="' + yearMeanRadius + '" cy="' + yearMeanCy + '" fill="none" stroke="yellow" stroke-width="3" cx="' + yearMeanCx + '"/>';

            // SVG for text "value" and "label"
            yearMeanSvg += '<text id="yearMean-value" x="' + (yearMeanCx - 57) + '" y="' + (55) + '">' + averages["1985 [YR1985]"].toFixed(2) + '</text>';
            yearMeanSvg += '<text id="yearMean-label" x="' + (yearMeanCx - 128) + '" y="' + (55) + '"> 1985 Mean -</text>';
            yearMeanSvg += "</svg>";

            //console.log("yearMeanSVG: ", yearMeanSvg); //debug

            // Add yearMean svg to container
            container.insertAdjacentHTML('afterbegin', yearMeanSvg);

            //-------------------------------------------------------
            // Three Circles, using the exercise format, 
            // slightly different for vertical spacing and use of for loop over array
            //-------------------------------------------------------

            // Start the three circles svg string
            var circlesSvg = '<svg id="attribute-legend">';

            // Array of circle names to base loop on
            var circles = ["max", "mean", "min"];
            // Labels for each circle
            var labels = ["- Ethiopia, 1985", "- Mean, all years", "- Japan, 2020"]; // Custom labels

            // Loop to add each circle and text to a svg string
            for (var i = 0; i < circles.length; i++) {
                var radius = calcPropRadius(dataStats[circles[i]]);
                var cy = 60 - radius;

                // Circle string
                circlesSvg += '<circle class="legend-circle" id="' + circles[i] + '" r="' + radius + '" cy="' + cy + '" fill="#F47821" fill-opacity="0.7" stroke="#000000" cx="147"/>';

                // Evenly space out labels
                var textY = i * 14 + 30; // Adjusted for better spacing

                // Text string for values
                circlesSvg += '<text id="' + circles[i] + '-value" x="173" y="' + textY + '">' + Math.round(dataStats[circles[i]] * 100) / 100 + '</text>';
                // Text string for labels
                circlesSvg += '<text id="' + circles[i] + '-label" x="207" y="' + textY + '">' + labels[i] + '</text>';
            };

            // Close svg string
            circlesSvg += "</svg>";

            //console.log("circlesSVG: ", circlesSvg); //debug

            // Add attribute legend svg to container
            container.insertAdjacentHTML('beforeend', circlesSvg);

            //---------------------------------------------------------
            // Comparison colored, toggled, rectangles
            //---------------------------------------------------------
            // Start the toggled greater than, lesser than rectangels and labels svg
            var toggleRectSvg = '<svg id="toggle-legend" style="display: none;">';            

            // Rectangle and text for "Greater"
            toggleRectSvg += '<rect class="legend-rectangle" id="lesserRect" x="43" y="28" width="15" height="15" fill="#4dac26" rx="5" ry="5" />';
            toggleRectSvg += '<text x="130" y="39" text-anchor="end" fill="black">Greater than</text>';

            
            // Rectangle and text for "Lesser"
            toggleRectSvg += '<rect class="legend-rectangle" id="greaterRect" x="43" y="59" width="15" height="15" fill="#d01c8b" rx="5" ry="5" />';
            toggleRectSvg += '<text x="130" y="70" text-anchor="end" fill="black">Lesser than</text>';
            
            toggleRectSvg += "</svg>";
            
            //console.log("toggleRectSVG:", toggleRectSvg); //debug
            
            container.insertAdjacentHTML('afterbegin', toggleRectSvg);

            // ----------------additional legend text------------------

            container.insertAdjacentHTML('beforeend', "<small>births per 1,000 people annually<br>Data Source: worldbank.org</small>");

            //disable map interaction over legend container
            L.DomEvent.disableClickPropagation(container);

            return container;            
        }
    });

    map.addControl(new LegendControl());
    console.log("Legend added to the map."); //debug
};

// updates the legend elements as you sequence
function updateLegend(attribute, averages) {
    //Update the label to include the year
    var year = attribute.match(/\d{4}/)[0];
    var yearMeanLabel = document.getElementById('yearMean-label');
    if (yearMeanLabel) {
        yearMeanLabel.textContent = year + " Mean -";
    };

    // Extract the year from the attribute
    var year = attribute.match(/\d{4}/)[0];

    // Update the legend text and mean value for the year
    if (averages[attribute]) {
        var meanValue = averages[attribute].toFixed(2);
        
        // add the mean value element to the legend
        document.getElementById('yearMean-value').textContent = meanValue; 

        // update the svg elements as you sequence and calculate new circle radius
        var yearMeanRadius = calcYearMeanRadius(averages[attribute]);
        var yearMeanCircle = document.getElementById('yearMean');
        if (yearMeanCircle) {
            var fixedBottom = 70; // Fixed bottom position for the circle to match three circle stack
            var yearMeanCy = fixedBottom - yearMeanRadius;
            yearMeanCircle.setAttribute('r', yearMeanRadius); // Update the radius
            yearMeanCircle.setAttribute('cy', yearMeanCy); // Update the cy position
        } else {
            console.error('Element with ID "yearMean" not found.'); //debug
        }
    } else {
        console.error(`Average value for ${attribute} not found.`); //debug
    }
};

// Flannery formula to calculate the yearMean circle radius
function calcYearMeanRadius(attValue) {
    var minRadius = minValue / 1.5;
    var radius = 1.3083 * Math.pow(attValue / minValue, 0.5715) * minRadius;
    return radius;
};

//update prop symbols as you sequence, or as the toggle checkbox is checked on and off.
function updatePropSymbols(attribute) {
    //cycle through each layer on the map
    map.eachLayer(function(layer) {
        if (layer.feature && layer.feature.properties[attribute]) {
            var props = layer.feature.properties;

            // Calculate the radius based on the attribute value
            var radius = calcPropRadius(props[attribute]);
            layer.setRadius(radius);

            // Determine the color based on the difference with the yearly mean value
            const country = props["Country Name"];
            const diff = differences[country][attribute];
            const color = useDifferenceColors ? (diff < 0 ? '#d01c8b' : '#4dac26') : '#F47821';
            layer.setStyle({ fillColor: color });

            // Create the popup content to update the values and the year in the sequence
            var popupContent = "<p><b>Country: </b>" + props["Country Name"] + "</p>";
            var year = attribute.match(/\d{4}/)[0];

            //other popup text
            popupContent += "<p><b>Crude birth rate in " + year + ": </b>" + props[attribute] + "</p>";

            // Update the popup content
            var popup = layer.getPopup();            
            popup.setContent(popupContent).update();
        }
    })
};

//calculate yearly mean values (at some point I switched from average to mean, during svg creation I think)
function calculateAverages(data, years) {
    const averages = {};
    //calculate for each year in the years array
    years.forEach(year => {
        let sum = 0;
        let count = 0;
        data.features.forEach(feature => {
            const value = feature.properties[year];
            if (!isNaN(value)) {
                sum += value;
                count++;
            }
        });
        averages[year] = sum / count;
    });
    console.log("averages: ", averages) //debug to check calc
    return averages;
};

//calculate the difference between the value of each country for that year and that year's average
function calculateDifferences(data, averages, years) {
    //instantiate differences object
    const differences = {};
    //cycles through each item in the json
    data.features.forEach(feature => {
        //gets the country name from the json passed as "data"
        const country = feature.properties["Country Name"];
        
        differences[country] = {};

        //then runs those values against the averages for each year
        years.forEach(year => {
            const value = feature.properties[year];
            differences[country][year] = value - averages[year];
        });
    });
    console.log("differences: ", differences) //debug to see the differences per country per year
    return differences;
};

/*
function addToggleButton(map, differences, years) {
    // Create a new Leaflet control for the button
    var ToggleControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function() {
            // Create the control container with a particular class name
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

            // Create the button element
            var button = L.DomUtil.create('button', '', container);
            button.innerHTML = 'Toggle Colors';
            button.style.backgroundColor = 'white';
            button.style.border = '2px solid gray';
            button.style.padding = '5px';

            // Add click event listener to the button
            button.onclick = function() {
                toggleColorScale(differences, years);
            };

            return container;
        }
    });

    // Add the new control to the map
    map.addControl(new ToggleControl());
};


function addToggleRadioButton(map, differences, years) {
    var ToggleControl = L.Control.extend({
        options: {
            position: 'topright'
        },

        onAdd: function() {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

            // Create the radio button element
            var radioButton = L.DomUtil.create('input', '', container);
            radioButton.type = 'radio';
            radioButton.id = 'toggleRadioButton';
            radioButton.name = 'colorToggle';
            radioButton.style.margin = '5px';

            // Create the label for the radio button
            var label = L.DomUtil.create('label', '', container);
            label.htmlFor = 'toggleRadioButton';
            label.innerHTML = 'Toggle Colorz';
            label.style.margin = '5px';

            // Add change event listener to the radio button
            radioButton.onchange = function() {
                toggleColorScale(differences, years);
            };

            return container;
        }
    });

    map.addControl(new ToggleControl());
};
*/

// add the checkbox to toggle on and off to RECLASSIFY the points to show comparisons to global averages.
function addToggleCheckbox(map, differences, years) {
    var ToggleControl = L.Control.extend({ //extending the L.Control method
        options: {
            position: 'bottomright' //crazy you can't do "top", "right", etc...
        },

        //onAdd is part of L.Control class, it is returning the container with the HTML and styling
        //in here, we also call the toggleColorScale function with the box checking/unchecking
        onAdd: function() { 
            var container = L.DomUtil.create('div', 'legend-checkbox');

            // Create the checkbox element
            var checkbox = L.DomUtil.create('input', '', container);
            checkbox.type = 'checkbox';
            checkbox.id = 'toggleCheckbox';
            checkbox.style.margin = '5px';
            checkbox.style.backgroundColor = '#f0f0f0';

            // Create the label for the checkbox
            var label = L.DomUtil.create('label', '', container);
            label.htmlFor = 'toggleCheckbox';
            label.innerHTML = 'Toggle Mean Value Comparison Colors';
            label.style.margin = '5px';

            // Add event listener to the checkbox, call toggleColorScale when checked/unchecked
            checkbox.onchange = function() {
                toggleColorScale(differences, years);
            };

            //disable map interaction over checkbox space
            L.DomEvent.disableClickPropagation(container); //quick click click was an issue

            return container;
        }
    });

    map.addControl(new ToggleControl()); //add ToggleControl, created above, to the map
};


function toggleColorScale(differences, years) {

    //boolean toggle controller, if true, evaluates to false, if false evaluates to true
    //triggered on the checking of the toggle checkbox, starts as false
    useDifferenceColors = !useDifferenceColors;
    const year = years[0];

    //use the differences table to make the comparisons for the year sequenced and color accordingly
    map.eachLayer(function(layer) {
        if (layer.feature) {
            const country = layer.feature.properties["Country Name"];
            const diff = differences[country][year];

            // if useDifferenceColors is false, color orange default
            // if true run inner comparison, color for positive or negative difference value
            const color = useDifferenceColors ? (diff < 0 ? '#d01c8b' : '#4dac26') : '#F47821'; //(condition ? value_if_true : value_if_false) : third_option
            layer.setStyle({ fillColor: color }); //replace the fill color
        }
    });

    // Toggle the visibility of the new legend section using the boolean toggle controller
    const toggleLegend = document.getElementById('toggle-legend');
    if (useDifferenceColors) {
        toggleLegend.style.display = 'block';
    } else {
        toggleLegend.style.display = 'none';
    }

    updateLegendColors(); // Ensure legend colors are updated with checkbox clicking
};

// This function is called when the checkbox is checked/unchecked and on each sequence
// to ensure that the colors update as the yearly mean circle changes in the legend.
function updateLegendColors() {
    // Get the yearMean circle element from the DOM
    const yearMeanCircle = document.getElementById('yearMean');
    if (!yearMeanCircle) {
        console.error('Element with ID "yearMean" not found.');
        return;
    }

    // Get the radius of the yearMean circle and convert it to a floating-point number
    const yearMeanRadius = parseFloat(yearMeanCircle.getAttribute('r'));
    // Get all elements with the class 'legend-circle'
    const legendCircles = document.querySelectorAll('.legend-circle');

    // Iterate over each legend circle
    legendCircles.forEach(circle => {
        const id = circle.id;
        const radius = parseFloat(circle.getAttribute('r'));
        let color;

        // Determine the color based on whether useDifferenceColors is true or false
        if (useDifferenceColors) {
            color = radius > yearMeanRadius ? '#4dac26' : '#d01c8b';
        } else {
            color = '#F47821';
        }

        // Specifically handle the yearMean circle to ensure it has no fill color
        if (id === 'yearMean') {
            color = 'none'; // Ensure no fill color for yearMean circle
        }

        // Set the fill color of the circle
        circle.setAttribute('fill', color);
    });
};


//first event listener creates the map upon the page loading
document.addEventListener('DOMContentLoaded', createMap);