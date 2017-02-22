'use strict';

// To-do list: ====================
// TODO: attack capability; calculations for how large of an invasion/defense group to make
// TODO: small creep distraction cloud? would require manual pathfinding
// TODO: safe mode trigger

// Import everything needed
require('require');

// Main loop
module.exports.loop = function () {
    // Clear memory for non-existent creeps
    for (let name in Memory.creeps) {
        if (Game.creeps[name] == undefined) {
            delete Memory.creeps[name];
        }
    }
    // Animate each creep
    for (let name in Game.creeps) {
        Game.creeps[name].run();
    }
    // Animate each room
    for (let name in Game.rooms) {
        var room = Game.rooms[name];
        // Animate each room brain
        room.brain.run();
        // Animate each tower
        var towers = room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_TOWER});
        for (let i in towers) {
            towers[i].run();
        }
    }
};