// Sieger - large armored worker specializing in taking down walls while under fire
// Best used to siege a contiguous room; healing stations of some sort should be stationed in the neighboring room
// Sieger will dismanlte walls while under fire until it is low enough that it needs to leave the room to be healed

import {taskGetBoosted} from "../tasks/task_getBoosted";
import {taskGoToRoom} from "../tasks/task_goToRoom";
import {taskDismantle} from "../tasks/task_dismantle";
import {AbstractCreep, AbstractSetup} from "./Abstract";


export class SiegerSetup extends AbstractSetup {
    constructor() {
        super('sieger');
        // Role-specific settings
        this.settings.bodyPattern = [TOUGH, WORK, MOVE, MOVE, MOVE, HEAL];
        this.settings.moveBoostedBodyPattern = [TOUGH, WORK, WORK, MOVE, HEAL];
        this.settings.nonArmoredBodyPattern = [WORK, MOVE];
        this.settings.bodyPattern = this.settings.nonArmoredBodyPattern; // TODO: remove this if needed
        this.settings.boost = {
            'tough': false,
            'work': false,
            'move': false,
            'heal': false,
        };
        this.settings.boostMinerals = {
            'tough': RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
            'work': RESOURCE_CATALYZED_ZYNTHIUM_ACID,
            'move': RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
            'heal': RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
        };
        this.settings.orderedBodyPattern = true;
        this.settings.avoidHostileRooms = false;
        this.roleRequirements = (creep: Creep) => creep.getActiveBodyparts(WORK) > 1 &&
                                                  creep.getActiveBodyparts(HEAL) > 1 &&
                                                  creep.getActiveBodyparts(MOVE) > 1
    }

    onCreate(creep: protoCreep): protoCreep {
        creep.memory.data.healFlag = "HP1"; // TODO: hard coded
        return creep;
    }
}

export class SiegerCreep extends AbstractCreep {
    
    assignment: Flag;
    
    constructor(creep: Creep) {
        super(creep);
    }

    findTarget(): Structure | void {
        var target;
        var targetPriority = [
            () => this.pos.findClosestByRange(_.map(_.filter(this.room.flags, flagCodes.destroy.dismantle.filter),
                                                     (flag: Flag) => flag.pos.lookFor(LOOK_STRUCTURES)[0])),
            // () => this.pos.findClosestByRange(FIND_HOSTILE_SPAWNS),
            () => this.pos.findClosestByRange(
                FIND_HOSTILE_STRUCTURES, {filter: (s: Structure) => s.hits && s.structureType == STRUCTURE_TOWER}),
            () => this.pos.findClosestByRange(
                FIND_HOSTILE_STRUCTURES, {filter: (s: Structure) => s.hits && s.structureType != STRUCTURE_RAMPART}),
            () => this.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {filter: (s: Structure) => s.hits}),
            () => this.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (s: Structure) => !s.room.my && !s.room.reservedByMe && s.hits,
            }),
        ];
        for (let targetThis of targetPriority) {
            target = targetThis() as Structure;
            if (target) {
                return target;
            }
        }
    }

    retreatAndHeal() { // TODO: make this a task
        this.heal(this);
        return this.travelTo(this.memory.data.healFlag, {allowHostile: true});
    }

    getBoosted() {
        for (let bodypart in this.settings.boost) {
            if (this.settings.boost[bodypart] &&
                !(this.memory.boosted && this.memory.boosted[this.settings.boostMinerals[bodypart]])) {
                let boosters = _.filter(this.room.labs, (lab: StructureLab) =>
                                        lab.assignedMineralType == this.settings.boostMinerals[bodypart] &&
                                        lab.mineralAmount >= 30 * this.getActiveBodyparts(bodypart),
                );
                if (boosters.length > 0) {
                    this.task = null;
                    this.assign(new taskGetBoosted(boosters[0]));
                }
            }
        }
    }

    run() {
        this.getBoosted();
        var assignment = this.assignment as Flag;
        // 1: retreat to heal point when injured
        if (deref(this.memory.data.healFlag) && // if there's a heal flag
            (this.getActiveBodyparts(TOUGH) < 0.5 * this.getBodyparts(TOUGH) || // if you're injured
             (this.memory.needsHealing && this.hits < this.hitsMax))) { // if you're healing and not full hp
            // TODO: dps-based calculation
            this.memory.needsHealing = true;
            return this.retreatAndHeal();
        } else {
            this.memory.needsHealing = false; // turn off when done healing
        }
        // 2: task assignment
        if ((!this.task || !this.task.isValidTask() || !this.task.isValidTarget())) { // get new task
            this.task = null;
            // 2.1: move to same room as assignment
            if (assignment && !this.creep.inSameRoomAs(assignment)) {
                let task = new taskGoToRoom(assignment);
                task.data.travelToOptions['allowHostile'] = true;
                this.assign(task);
            }
            // 2.2: ATTACK SOMETHING
            var target = this.findTarget();
            if (target) {
                let task = new taskDismantle(target);
                task.data.travelToOptions['allowHostile'] = true;
                this.assign(task);
            }
        }
        // execute task
        if (this.task) {
            return this.task.step();
        }
        // remove flag once everything is destroyed
        if (assignment && this.room.hostileStructures.length == 0) {
            this.log("No remaining hostile structures in room; deleting flag!");
            assignment.remove();
        }
    }
}
