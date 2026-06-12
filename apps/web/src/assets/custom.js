$(document).ready(function() {   
 "use strict";
  $.validator.setDefaults({
    submitHandler: function () {
      form.submit();
    }
  });


     $(".loader-wrapper").fadeOut("slow");


    setTimeout(function() {
      $('#alertmessage').fadeOut('slow');
    }, 5000);
    // tracking fadeout
    var lastPart = window.location.href.split("/").pop();
    if(lastPart!='tracking')
    {
        localStorage.clear();
    }
    setTimeout(function() {
        $('#message').fadeOut('slow');
    }, 5000);

    // datepicker
    $('.datepicker').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true,
        todayHighlight: true
    });
    $('.datepickerfuturedisable').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true,
        endDate: '+0d',
        todayHighlight: true
    });

    $('.datepickerpastdisable').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true,
        startDate: new Date(),
        todayHighlight: true
    }); 

    $("input").attr("autocomplete", "off");
    // customer selectize
    $('.selectized').selectize();
    // trip pending amount
    $("#t_trip_paymentstatus").change(function() {
        var selectedVal = $('option:selected', this).text();
        console.log(selectedVal);
        if (selectedVal == "pending") {
            $('.t_trip_pendingamount').css('display', 'block');

        } else {
            $('.t_trip_pendingamount').css('display', 'none');
        }
    });
    $.validator.addMethod('lessThanEqual', function(value, element, param) {
        if (this.optional(element)) return true;
        var i = parseInt(value);
        var j = parseInt($('#pendingamount').val());
        return i <= j;
    }, "");
    // jquery validate
    $('#add_driver,#vehicle_add,#customer_add,#login,#trip_add,#Income_Expense,#fuel,#track,#geofencesave,#trippayments,.basicvalidation,#smtpconfigtestemail').validate({
        errorClass: "invalid-feedback",
        rules: {
        	 testemailto : {
                required: true,
                 email: true,
            },
            password : {
                minlength : 5
            },
            cnfpassword : {
                minlength : 5,
                equalTo : "#password"
            },
            d_name: {
                required: true,
            },
            d_mobile: {
                required: true,
                number: true,
                minlength: 9,
                maxlength: 13,
            },
            d_age: {
                required: true,
                number: true,
                min: 18,
                max: 70,
            },
            d_licenseno: {
                required: true,
            },
            d_license_expdate: {
                required: true,

            },
            d_total_exp: {
                required: true,
            },
            d_doj: {
                required: true,
            },
            d_total_exp: {
                required: true,
                number: true,
                min: 0,
                max: 70,
            },
            d_address: {
                required: true,
            },
            v_registration_no: {
                required: true
            },
            v_name: {
                required: true
            },
            v_model: {
                required: true,
            },
            v_chassis_no: {
                required: true,
            },
            v_engine_no: {
                required: true,
            },
            v_manufactured_by: {
                required: true,
            },
            v_reg_exp_date: {
                required: true,
            },
            v_group: {
                required: true,
            },
            c_name: {
                required: true,
            },
            c_mobile: {
                required: true,
                number: true,
                minlength: 9,
                maxlength: 13,
            },
            c_email:{
                email: true,
                required: true,
            },
            c_address: {
                required: true,
            },
             t_customer_id: {
                required: true,
            },
            t_vechicle: {
                required: true,
            },
            t_driver: {
                required: true,
            },
            t_type: {
                required: true,
            },
            t_trip_fromlocation: {
                required: true,
            },
            t_trip_tolocation: {
                required: true,
            },
            t_start_date: {
                required: true,
            },
            t_end_date: {
                required: true,
            },
            t_trip_amount: {
                required: true,
                number: true,
                minlength: 3,
                maxlength: 6,
            },
            e_expense_amount: {
                required: true,
                number: true,
                minlength: 2,
                maxlength: 6,
            },
            ie_amount: {
                required: true,
                number: true,
                minlength: 2,
                maxlength: 6,
            },
             ie_description: {
                required: true,
            },
             ie_date: {
                required: true,
            },
             ie_type: {
                required: true,
            },
             ie_v_id: {
                required: true,
            },
            v_fuelprice: {
                required: true,
                number: true,
                minlength: 3,
                maxlength: 6,
            },
            v_fuel_quantity: {
                required: true,
                number: true,
                minlength: 1,
                maxlength: 6,
            },
            v_odometerreading: {
                required: true,
                number: true,
                minlength: 1,
            },
             v_fuelfilldate: {
                required: true,
            },
             v_fleetaddedby: {
                required: true,
            },
             v_id: {
                required: true,
            },
            v_fleetcomments: {
                 maxlength: 30,
            },
            fromdate: {
                required: true,
            },
            todate: {
                required: true,
            },
            t_vechicle: {
                required: true,
            },
             v_type: {
                required: true,
            },
            geo_name:{
                required: true,
            },
            geo_description:{
                required: true,
            },
            tp_amount:{
                lessThanEqual: true,
                required: true,
            },
            tp_notes:{
                required: true,
            },
        },
        messages: {
             v_type: {
                required: "Vehicle type is required",
            },
            d_name: {
                required: "Driver name is required",
            },
            d_mobile: {
                required: "Mobile number is required",
                number: "Please enter valid number",
            },
            d_licenseno: {
                required: "License number is required",
            },
            d_license_expdate: {
                required: "License expiry date is required",
            },
            d_doj: {
                required: "Date of joining is required",
            },
            d_total_exp: {
                required: "Total experiance is required",
            },
            d_address: {
                required: "Address is required",
            },
            v_manufactured_by: {
                required: "Manufactured by is required",
            },
            v_reg_exp_date: {
                required: "Registration expiry date is required",
            },
            v_group: {
                required: "Vehicle group is required",
            },
            v_engine_no: {
                required: "Engine number is required",
            },
            v_chassis_no: {
                required: "Chassis number is required",
            },
            v_model: {
                required: "Model is required",
            },
            v_registration_no: {
                required: "Registration number is required",
            },
            v_name: {
                required: "Vehicle name is required",
            },
            c_mobile: {
                required: "Mobile number is required",
                number: "Please enter valid number",
            },
            c_name: {
                required: "Customer name is required",
            },
            c_email:{
                required: "Customer email is required",
            },
            c_address: {
                required: "Customer address is required",
            },
            t_vechicle: {
                required: "Choose vechicle",
            },
            t_driver: {
                required: "Choose driver",
            },
            t_type: {
                required: "Choose type of trip",
            },
            t_trip_fromlocation: {
                required: "Select trip start location",
            },
            t_trip_tolocation: {
                required: "Select trip to/end location",
            },
            t_start_date: {
                required: "Select trip start date",
            },
            t_end_date: {
                required: "Select trip to/end date",
            },
            t_trip_amount: {
                required: "Trip amount/rent is required",
                number: "Please enter valid number",
            },
            geo_name:{
                required: "Geofence name is required",
            },
            geo_description:{
                required: "Geofence description is required",
            },
             tp_amount:{
                required: "Amount is required",
                lessThanEqual : "Amount must be less than pending amount"
            },
             tp_notes:{
                required: "Payment notes is required",
            },
            ie_amount:{
                required: "Amount is required",
            },
            errorElement: 'span',
            errorPlacement: function (error, element) {
              error.addClass('invalid-feedback');
              element.closest('.form-group').append(error);
            },
            highlight: function (element, errorClass, validClass) {
              $(element).addClass('is-invalid');
            },
            unhighlight: function (element, errorClass, validClass) {
              $(element).removeClass('is-invalid');
            }

        },
        errorElement: 'span',
        errorPlacement: function (error, element) {
          error.addClass('invalid-feedback');
          element.closest('.form-group').append(error);
        },
        highlight: function (element, errorClass, validClass) {
          $(element).addClass('is-invalid');
        },
        unhighlight: function (element, errorClass, validClass) {
          $(element).removeClass('is-invalid');
        }
      });
    $("#v_registration_no").on('keypress change', function(event) {
       var data=$(this).val();
       $("#v_api_username").val(data);
    });
    
  
    $('#fueltbl').DataTable({
       "bLengthChange": false,
       "bInfo": false,
       "ordering": false,
       "orderFixed": [ 11, 'desc' ],
       "rowGroup": {
            "dataSrc": 11
        }
    });
    $('#bookingstbl,#vgeofencetbl,.datatable').DataTable({
       "bLengthChange": false,
       "pageLength" : 5,
       "bInfo": false,
       "ordering": false
    });
    $('.datatableexport').DataTable({
       "bInfo": false,
       "ordering": false,
        dom: 'Bfrtip',
        buttons: [
        'copyHtml5',
        'excelHtml5',
        'csvHtml5',
        'pdfHtml5'
    ]
    });

    $('#invoiceTbl').DataTable({
        "ordering": true,
        "orderFixed": [ 8, 'desc' ],
    })
    $('#quotationstbl').DataTable({
        "ordering": true,
        "orderFixed": [ 8, 'asc' ]
    })
    $('#custtbl').DataTable({
        "ordering": true,
        "orderFixed": [ 1, 'asc' ]
    })
    $('#vehiclelisttbl').DataTable({
        "ordering": true,
        "orderFixed": [ 1, 'asc' ]
    })
    $('#trailerlisttbl').DataTable({
        "ordering": true,
        "orderFixed": [ 2, 'asc' ]
    })
    $('#driverslisttbl').DataTable({
        "ordering": true,
        "orderFixed": [ 7, 'desc' ]
    })
    $('#incomexpensetbl').DataTable({
        "ordering": true,
        "orderFixed": [ 1, 'asc' ]
    })
    $('#inspectiontbl').DataTable({
        "ordering": false,
    })
    $('#timelisttbl').DataTable({
        "ordering": true,
        "orderFixed": [ 0, 'asc' ]
    })
    $('#tripsheettbl').DataTable({
        "ordering": true,
        "orderFixed": [ 1, 'asc' ]
    })
    $('#loadsheettbl').DataTable({
        "ordering": true,
        "orderFixed": [ 1, 'asc' ]
    })
    $('#driverxpensetbl').DataTable({
        "ordering": true,
        "orderFixed": [ 0, 'asc' ]
    })
    
    

    var customOrder = {
      "Yet to Confirm": 1,
      "Yet to start": 2,
      "Ongoing": 3,
      "Completed": 4
    };

    // register custom ordering that maps cell text -> numeric priority
    $.fn.dataTable.ext.order['status-order'] = function(settings, col) {
      return this.api().column(col, { order: 'index' }).data().map(function (d) {
        // strip HTML and trim whitespace so mapping matches
        var text = (typeof d === 'string') ? d.replace(/<[^>]*>/g, '').trim() : String(d);
        return customOrder[text] || 999; // unknown statuses go to the end
      });
    };

    var table = $('#triptbl').DataTable({
      rowGroup: { dataSrc: 11 },        // group by column index 11
      ordering: true,
      order: [[11, 'asc']],            // initial order by custom priority (asc => 1..4)
      orderFixed: [[11, 'asc']],       // optional: keep grouping column order fixed
      columnDefs: [
        { targets: 11, orderDataType: 'status-order' } // use our custom sorter on col 11
        //,{ targets: 11, visible: false } // optionally hide the grouping column
      ]
    });
    
});
// expense fields
    var row = 1;
    function expense_fields() {
        row++;
        var objTo = document.getElementById('new_exp_row')
        var divtest = document.createElement("div");
        divtest.setAttribute("class", "removeclass" + row);
        var rdiv = 'removeclass' + row;
        divtest.innerHTML = '<div class="row"> <div class="col-sm-6 col-md-3 "> <div class="form-group"> <input type="text" class="form-control" id="e_expense_type" required="true" name="e_expense_type[]" value="" placeholder="Expense Type"> </div> </div> <div class="col-sm-6 col-md-3 "> <div class="form-group"> <input type="text" class="form-control" id="e_expense_desc" required="true" name="e_expense_desc[]" value="" placeholder="Expense description"> </div> </div> <div class="col-sm-3 col-md-3"> <div class="form-group"> <input type="text" class="form-control" id="e_expense_amount" required="true" name="e_expense_amount[]" value="" placeholder="Value"> </div> </div> <div class="col-sm-3 col-md-3"> <div class="input-group-btn"> <button class="btn btn-danger" type="button" onclick="remove_expense_fields(' + row + ');"> <span class="fe fe-minus" aria-hidden="true"></span> </button> </div> </div> </div> <div class="clear"></div>';
        objTo.appendChild(divtest)
    }
    // remove expense fields
    function remove_expense_fields(rid) {
        $('.removeclass' + rid).remove();
    }

function alertmessage(msg,type) {
    if(type==1) {
        const Toast = Swal.mixin({toast: true,position: 'top',showConfirmButton: false,timer: 5000});
        Toast.fire({
          type: 'success',
          title: msg
        });
    }
    if(type==2) {
         const Toast = Swal.mixin({toast: true,position: 'top',showConfirmButton: false,timer: 5000});
        Toast.fire({
          type: 'error',
          title: msg
        });
    }
}

$('#showgeofencemodel').on('click', function(e){
    e.preventDefault();
    var geo_area = $('#geo_area').val();
    if (geo_area == "") {
          alertmessage('Please select area in map',2);
    } else {
        $('#modal-geofence').modal('show');
    }
});


$('.geofenceviewpopup').on('click', function(e){
    e.preventDefault();
    var base = $('#base').val();
    $.ajax({
        type: "post",
        data: {'id':$(this).data('id')},
        url: base+"geofence/geofence_get",
        dataType: 'json',
        success: function (result) {
            if(result=='false') {
                 alertmessage('Failed to fetch geo data',2);
            } else {
                console.log(result);
                var center = result[0].split(",");
                var latcenter = parseFloat(center[0]);
                var logcenter = parseFloat(center[1]);
                var mapProp = {
                   center:new google.maps.LatLng(latcenter,logcenter),
                   zoom:18,
                   mapTypeId:google.maps.MapTypeId.ROADMAP,
                    scrollwheel: true,
                    gestureHandling: 'cooperative'
                };
                var map = new google.maps.Map(document.getElementById("googleMap"),mapProp);  

                var AreaCoords = new Array();
                $.each( result, function( key, val ) {
                    var val = val.split(",");
                    var lat = parseFloat(val[0]);
                    var log = parseFloat(val[1]);
                  AreaCoords.push(new google.maps.LatLng(lat, log));
                });
                console.log(AreaCoords)
                var tourplan = new google.maps.Polyline({
                   path:AreaCoords,
                   strokeColor:"#0817FA",
                   strokeOpacity:0.6,
                   strokeWeight:2
                });           
                tourplan.setMap(map);
                $('#geofencepopupmodel').modal('show');
            }
        }
    });
});

$('.logodelete').on('click', function(){
   $.ajax({
    url: 'logodelete',
    type: 'post',
    dataType: 'json',
    data: '',
    success: function(response){ 
      location.reload();
    }
  });
 });


$('.todayreminderread').on('click', function(e){
   e.preventDefault();
    var base = $('#base').val();
    var rid = $(this).data('id');
    $.ajax({
        type: "post",
        data: {'r_id':rid},
        url: base+"dashboard/remindermark",
        dataType: 'json',
        success: function (result) {
            if(result==1) {
                $('#'+rid).remove();
                alertmessage('Reminder marked as read',1);
            } else {
                alertmessage('Something went wrong',2);
            }
        }
  });  
 });

$('.driver-select #t_driver').on('change', function(e){
    var d_id = $(this).val();
    var base = $('#base').val();
    $.ajax({
        type: "post",
        data: {'d_id': d_id},
        url: base+"drivers/get_driver_ajax",
        dataType: 'json',
        success: function (result) {
            console.log(result);
            $('#driver-total-info').html("");
            if (result['capacity']) {
                if (result['loaded'] == result['capacity'] != null) {
                    $('#driver-total-info').html(" - ("+result['loaded']+" / "+result['capacity']+") Driver at max capacity");
                } else if (result['loaded'] > result['capacity']) {
                    $('#driver-total-info').html(" - (<b>This driver is over loaded! Please choose another.</b>)");
                    $('#t_driver option:first-child').attr("selected", "selected");
                    return;
                } else {
                    $('#driver-total-info').html(" - ("+result['loaded']+" / "+result['capacity']+") Loaded for this driver");
                }
            }

            if (result[0]['d_truck_id'] != 0) {
                $('.truck-select #t_vechicle').val(result[0]['d_truck_id']);
                //$('.truck-select #t_vechicle').prop('disabled', true);
            } else {
                $('.truck-select #t_vechicle').val("");
                //$('.truck-select #t_vechicle').prop('disabled', false);
            }
            if (result[0]['d_trailer_id'] != 0) {
                $('.trailer-select #t_trailer').val(result[0]['d_trailer_id']);
                //$('.trailer-select #t_trailer').prop('disabled', true);
            } else {
                $('.trailer-select #t_trailer').val("");
                //$('.trailer-select #t_trailer').prop('disabled', false);
            }
        }
    });
})