module.exports = function(RED)
{
	"use strict";

	function HueMotion(config)
	{
		RED.nodes.createNode(this, config);
		var scope = this;
		let bridge = RED.nodes.getNode(config.bridge);
		let { HueMotionMessage } = require('../utils/messages');

		// SAVE LAST STATE
		var lastState = false;

		//
		// CHECK CONFIG
		if(!config.sensorid || bridge == null)
		{
			this.status({fill: "red", shape: "ring", text: "hue-motion.node.not-configured"});
			return false;
		}

		//
		// UPDATE STATE
		scope.status({fill: "grey", shape: "dot", text: "hue-motion.node.no-motion"});

		//
		// ON UPDATE
		bridge.events.on('sensor' + config.sensorid, function(sensor)
		{
			if(sensor.config.reachable == false)
			{
				// SEND STATUS
				scope.status({fill: "red", shape: "ring", text: "hue-motion.node.not-reachable"});
			}
			else if(sensor.config.on == true)
			{
				// SEND STATUS
				if(sensor.state.presence)
				{
					scope.status({fill: "green", shape: "dot", text: "hue-motion.node.motion"});
				}
				else
				{
					scope.status({fill: "grey", shape: "dot", text: "hue-motion.node.activated"});
				}

				// SEND MESSAGE
				var hueMotion = new HueMotionMessage(sensor, true, lastState);
				if(!config.skipevents) { scope.send(hueMotion.msg); }

				// SAVE LAST STATE
				lastState = sensor;
			}
			else if(sensor.config.on == false)
			{
				// SEND STATUS
				scope.status({fill: "red", shape: "ring", text: "hue-motion.node.deactivated"});

				// SEND MESSAGE
				var hueMotion = new HueMotionMessage(sensor, false, lastState);
				if(!config.skipevents) { scope.send(hueMotion.msg); }

				// SAVE LAST STATE
				lastState = sensor;
			}
		});


		//
		// DISABLE / ENABLE SENSOR
		this.on('input', function(msg, send, done)
		{
			// Node-RED < 1.0
			send = send || function() { scope.send.apply(scope,arguments); }

			// GET CURRENT STATE
			if(typeof msg.payload != 'undefined' && typeof msg.payload.status != 'undefined')
			{
				bridge.client.sensors.getById(config.sensorid)
				.then(sensor => {
					var hueMotion = new HueMotionMessage(sensor, (sensor.config.on) ? true : false, lastState);

					// SAVE LAST STATE
					lastState = sensor;

					return send(hueMotion.msg);
				});

				return true;
			}

			// CONTROL
			if(msg.payload == true || msg.payload == false)
			{
				bridge.client.sensors.getById(config.sensorid)
				.then(sensor => {
					sensor.config.on = msg.payload;
					return bridge.client.sensors.save(sensor);
				})
				.then(sensor => {
					var hueMotion = new HueMotionMessage(sensor, msg.payload, lastState);

					// SEND STATUS
					if(msg.payload == false)
					{
						scope.status({fill: "red", shape: "ring", text: "hue-motion.node.deactivated"});
					}
					else
					{
						scope.status({fill: "green", shape: "dot", text: "hue-motion.node.activated"});
					}

					// SEND MESSAGE
					if(!config.skipevents) { send(hueMotion.msg); }
					if(done) { done(); }

					// SAVE LAST STATE
					lastState = sensor;
				})
				.catch(error => {
					scope.error(error, msg);
					if(done) { done(error); }
				});
			}
		});


		//
		// CLOSE NODE / REMOVE EVENT LISTENER
		this.on('close', function()
		{
			bridge.events.removeAllListeners('sensor' + config.sensorid);
		});
	}

	RED.nodes.registerType("hue-motion", HueMotion);
}
