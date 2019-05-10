const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');

/**
 * Manage communication with a Dexter arm over a client WebSocket server.
 */
class Scratch3Dexter {

    /**
     * Construct a Dexter communication object.
     * @param {Runtime} runtime - the Scratch 3.0 runtime
     */
    constructor (runtime) {

        /**
         * The Scratch 3.0 runtime used to trigger the green flag button.
         * @type {Runtime}
         * @private
         */
        this._runtime = runtime;

        this.newSock();

        /**
         * The last status data Dexter sent.
         * @type {DataView}
         * @private
         */
        this._status = new DataView(new ArrayBuffer(60 * 4)); // 60 addresses, 32-bit int each

        /**
         * The next instruction number to send to Dexter.
         * @type {int}
         * @private
         */
        this._count = 0;
    }

    getInfo () {
        return {
            id: 'scratchDexter',
            name: 'Dexter HD',
            blockIconURI: 'data:image/png;base64,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',
            blocks: [
                {
                    opcode: 'moveAllJoints',
                    blockType: BlockType.COMMAND,
                    text: 'move all joints j1: [J1] ° j2: [J2] ° j3: [J3] ° j4: [J4 ° j5: [J5] °',
                    arguments: {
                        J1: {type: ArgumentType.ANGLE, default: 0},
                        J2: {type: ArgumentType.ANGLE, default: 0},
                        J3: {type: ArgumentType.ANGLE, default: 135},
                        J4: {type: ArgumentType.ANGLE, default: 45},
                        J5: {type: ArgumentType.ANGLE, default: 0}
                    },
                    func: 'move_all_joints'
                },
                {
                    opcode: 'moveTo',
                    blockType: BlockType.COMMAND,
                    text: 'move to x: [X] m y: [Y] m z: [Z] m direction x: [X_DIR] y: [Y_DIR] z: [Z_DIR] config: [LEFT_RIGHT] [UP_DOWN] [IN_OUT]',
                    arguments: {
                        X: {type: ArgumentType.NUMBER, default: 0},
                        Y: {type: ArgumentType.NUMBER, default: 0.5},
                        Z: {type: ArgumentType.NUMBER, default: 0.075},
                        X_DIR: {type: ArgumentType.STRING, menu: 'dexDirDirs', default: '0'},
                        Y_DIR: {type: ArgumentType.STRING, menu: 'dexDirDirs', default: '0'},
                        Z_DIR: {type: ArgumentType.STRING, menu: 'dexDirDirs', default: '-1'},
                        LEFT_RIGHT: {type: ArgumentType.STRING, menu: 'dexLeftRight', default: 'right'},
                        UP_DOWN: {type: ArgumentType.STRING, menu: 'dexUpDown', default: 'up'},
                        IN_OUT: {type: ArgumentType.STRING, menu: 'dexInOut', default: 'out'}
                    },
                    func: 'move_to'
                },
                {
                    opcode: 'pidMoveAllJoints',
                    blockType: BlockType.COMMAND,
                    text: 'pid move all joints j1: [J1] ° j2: [J2] ° j3: [J3] ° j4: [J4 ° j5: [J5] °',
                    arguments: {
                        J1: {type: ArgumentType.ANGLE, default: 0},
                        J2: {type: ArgumentType.ANGLE, default: 0},
                        J3: {type: ArgumentType.ANGLE, default: 135},
                        J4: {type: ArgumentType.ANGLE, default: 45},
                        J5: {type: ArgumentType.ANGLE, default: 0}
                    },
                    func: 'pid_move_all_joints'
                },
                {
                    opcode: 'getRobotStatus',
                    blockType: BlockType.COMMAND,
                    text: 'get robot status',
                    arguments: {},
                    func: 'get_robot_status'
                },
                {
                    opcode: 'getLast',
                    blockType: BlockType.REPORTER,
                    text: 'last [THING]',
                    arguments: {
                        THING: {type: ArgumentType.STRING, menu: 'dexLastThing', default: 'job number'}
                    },
                    func: 'get_last'
                },
                {
                    opcode: 'getLastOplet',
                    blockType: BlockType.REPORTER,
                    text: 'last oplet',
                    arguments: {},
                    func: 'get_last_oplet'
                },
                {
                    opcode: 'getLastErrored',
                    blockType: BlockType.BOOLEAN,
                    text: 'last instruction errored?',
                    arguments: {},
                    func: 'get_last_errored'
                },
                {
                    opcode: 'getJoint',
                    blockType: BlockType.REPORTER,
                    text: '[JOINT] [DATA]',
                    arguments: {
                        JOINT: {type: ArgumentType.STRING, menu: 'dexJointNames', default: 'base'},
                        DATA: {type: ArgumentType.STRING, menu: 'dexJointData', default: 'sin'}
                    },
                    func: 'get_joint'
                },
                {
                    opcode: 'getJoint6',
                    blockType: BlockType.REPORTER,
                    text: 'joint 6 [DATA]',
                    arguments: {
                        DATA: {type: ArgumentType.STRING, menu: 'dexJoint6Data', default: 'angle'}
                    },
                    func: 'get_joint_6'
                },
                {
                    opcode: 'getJoint7',
                    blockType: BlockType.REPORTER,
                    text: 'joint 7 [DATA]',
                    arguments: {
                        DATA: {type: ArgumentType.STRING, menu: 'dexJoint7Data', default: 'position'}
                    },
                    func: 'get_joint_7'
                },
                {
                    opcode: 'opcode',
                    blockType: BlockType.COMMAND,
                    text: 'send raw command [CMD]',
                    arguments: {
                        CMD: {type: ArgumentType.STRING, default: 'g'}
                    },
                    func: 'make_ins'
                },
                {
                    opcode: 'reload',
                    blockType: BlockType.COMMAND,
                    text: 'reload',
                    arguments: {},
                    func: 'reload'
                },
                {
                    opcode: 'emptyInstructionQueue',
                    blockType: BlockType.COMMAND,
                    text: 'empty instruction queue',
                    arguments: {},
                    func: 'empty_instruction_queue'
                }
            ],
            menus: {
                dexDirDirs: ['-1', '0', '1'],
                dexLeftRight: ['left', 'right'],
                dexUpDown: ['up', 'down'],
                dexInOut: ['in', 'out'],
                dexLastThing: [
                    'job number',
                    'instruction number',
                    'start time',
                    'end time'
                ],
                dexJointData: [
                    'position at',
                    'position delta',
                    'position PID delta',
                    'position force delta',
                    'sin',
                    'cos',
                    'measured angle',
                    'sent position'
                ],
                dexJointNames: ['base', 'pivot', 'end', 'angle', 'rot'],
                dexJoint6Data: ['angle', 'force'],
                dexJoint7Data: ['position', 'force']
            }
        };
    }

    newSock () {
        if (this._ws) this._ws.close();
        this._ws = new WebSocket('ws://localhost:3000');
        this._ws.addEventListener('close', this.onClose);
        this._ws.addEventListener('message', this.onData);
        this._ws.addEventListener('open', this.onOpen);
        this._ws.binaryType = 'arraybuffer';
    }

    checkSock () {
        if (this._ws) return;
        this.newSock();
    }

    onClose (evt) {
        console.log('closed');
        try {
            if (ext._ws && evt.code != 1006) {
                newSock();
            } else {
                console.log('disconnected (1006)');
            }
        } catch (e) {
            console.log('disconnected');
            self._ws = null;
        }
    }

    onData (msg) {
        this._status = new DataView(msg.data);
        console.log(this.get_last_oplet() + ' errored: ' + this.get_last_errored());
    }

    onOpen () {
        console.log('connected');
        this.get_robot_status();
    }

    make_ins (args) {
        console.log(args.CMD);
        this.checkSock();
        this._ws.send("1 " + (this._count++) + " 1 undefined " + args.CMD + " ;");
    }

    move_all_joints (args) {
        console.log('a ' + args.J1 + " " + args.J2 + " " + args.J3 + " " + args.J4 + " " + args.J5);
        this.checkSock();
        this._ws.send(
            "1 "
            + (this._count++)
            + " 1 undefined a "
            + args.J1 * 3600
            + " " + args.J2 * 3600
            + " " + args.J3 * 3600
            + " " + args.J4 * 3600
            + " " + args.J5 * 3600
            + " ;"
        );
    }

    move_to (args) {
        console.log('M ' + args.X + ' ' + args.Y + ' ' + args.Z + ' ' + args.X_DIR + ' ' + args.Y_DIR + ' ' + args.Z_DIR + ' ' + args.LEFT_RIGHT + ' ' + args.UP_DOWN + ' ' + args.IN_OUT);
        this.checkSock();
        this._ws.send(
            "1 " + (this._count++) + " 1 undefined M "
            + args.X * 1000000 + ' ' + args.Y * 1000000 + ' ' + args.Z * 1000000 + ' '
            + args.X_DIR + ' ' + args.Y_DIR + ' ' + args.Z_DIR + ' '
            + (0 + (args.LEFT_RIGHT == 'right')) + ' '
            + (0 + (args.UP_DOWN == 'up')) + ' '
            + (0 + (args.IN_OUT == 'out')) + ' ;'
        );
    }

    pid_move_all_joints (args) {
        console.log('P', args.J1, args.J2, args.J3, args.J4, args.J5);
        this.checkSock();
        this._ws.send(
            '1 ' + (this._count++) + ' 1 undefined P '
            + args.J1 * 3600 + " "
            + args.J2 * 3600 + " "
            + args.J3 * 3600 + " "
            + args.J4 * 3600 + " "
            + args.J5 * 3600 + " ;"
        );
    }

    get_robot_status () {
        console.log('g');
        this.checkSock();
        this._ws.send('1 ' + (this._count++) + ' 1 undefined g ;');
    }

    get_last (args) {
        return this._status.getInt32({
            'job number': 0,
            'instruction number': 1,
            'start time': 2,
            'end time': 3
        }[args.THING] * 4, true);
    }

    get_last_oplet () {
        return String.fromCharCode(this._status.getInt32(4 * 4, true));
    }

    get_last_errored () {
        return this._status.getInt32(5 * 4, true) > 0;
    }

    get_joint (args) {
        return this._status.getInt32(({
            'position at': 10,
            'position delta': 11,
            'position PID delta': 12,
            'position force delta': 13,
            'sin': 14,
            'cos': 15,
            'measured angle': 16,
            'sent position': 17
        }[args.DATA] + {
            'base': 0,
            'pivot': 10,
            'end': 20,
            'angle': 30,
            'rot': 40
        }[args.JOINT]) * 4, true);
    }

    get_joint_6 (args) {
        return this._status.getInt32((args.DATA == 'angle' ? 18 : 28) * 4, true);
    }

    get_joint_7 (args) {
        return this._status.getInt32((args.DATA == 'position' ? 38 : 48) * 4, true);
    }

    reload () {
        console.log('reload');
        try {
            this.newSock();
        } catch (e) {};
    }

    empty_instruction_queue () {
        console.log('F');
        this.checkSock();
        this._ws.send('1 1 1 undefined F ;');
    }

}
module.exports = Scratch3Dexter;
