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
            blockIconURI: 'https://user-images.githubusercontent.com/28599280/57841521-489a1700-77fd-11e9-959b-8defaa382436.png',
            blocks: [
                {
                    opcode: 'moveAllJoints',
                    blockType: BlockType.COMMAND,
                    text: 'move all joints j1: [J1] ° j2: [J2] ° j3: [J3] ° j4: [J4] ° j5: [J5] °',
                    arguments: {
                        J1: {type: ArgumentType.ANGLE, defaultValue: 0},
                        J2: {type: ArgumentType.ANGLE, defaultValue: 0},
                        J3: {type: ArgumentType.ANGLE, defaultValue: 135},
                        J4: {type: ArgumentType.ANGLE, defaultValue: 45},
                        J5: {type: ArgumentType.ANGLE, defaultValue: 0}
                    },
                    func: 'move_all_joints'
                },
                {
                    opcode: 'moveTo',
                    blockType: BlockType.COMMAND,
                    text: 'move to x: [X] m y: [Y] m z: [Z] m direction x: [X_DIR] y: [Y_DIR] z: [Z_DIR] config: [LEFT_RIGHT] [UP_DOWN] [IN_OUT]',
                    arguments: {
                        X: {type: ArgumentType.NUMBER, defaultValue: 0},
                        Y: {type: ArgumentType.NUMBER, defaultValue: 0.5},
                        Z: {type: ArgumentType.NUMBER, defaultValue: 0.075},
                        X_DIR: {type: ArgumentType.STRING, menu: 'dexDirDirs', defaultValue: '0'},
                        Y_DIR: {type: ArgumentType.STRING, menu: 'dexDirDirs', defaultValue: '0'},
                        Z_DIR: {type: ArgumentType.STRING, menu: 'dexDirDirs', defaultValue: '-1'},
                        LEFT_RIGHT: {type: ArgumentType.STRING, menu: 'dexLeftRight', defaultValue: 'right'},
                        UP_DOWN: {type: ArgumentType.STRING, menu: 'dexUpDown', defaultValue: 'up'},
                        IN_OUT: {type: ArgumentType.STRING, menu: 'dexInOut', defaultValue: 'out'}
                    },
                    func: 'move_to'
                },
                {
                    opcode: 'pidMoveAllJoints',
                    blockType: BlockType.COMMAND,
                    text: 'pid move all joints j1: [J1] ° j2: [J2] ° j3: [J3] ° j4: [J4] ° j5: [J5] °',
                    arguments: {
                        J1: {type: ArgumentType.ANGLE, defaultValue: 0},
                        J2: {type: ArgumentType.ANGLE, defaultValue: 0},
                        J3: {type: ArgumentType.ANGLE, defaultValue: 135},
                        J4: {type: ArgumentType.ANGLE, defaultValue: 45},
                        J5: {type: ArgumentType.ANGLE, defaultValue: 0}
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
                        THING: {type: ArgumentType.STRING, menu: 'dexLastThing', defaultValue: 'job number'}
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
                        JOINT: {type: ArgumentType.STRING, menu: 'dexJointNames', defaultValue: 'base'},
                        DATA: {type: ArgumentType.STRING, menu: 'dexJointData', defaultValue: 'sin'}
                    },
                    func: 'get_joint'
                },
                {
                    opcode: 'getJoint6',
                    blockType: BlockType.REPORTER,
                    text: 'joint 6 [DATA]',
                    arguments: {
                        DATA: {type: ArgumentType.STRING, menu: 'dexJoint6Data', defaultValue: 'angle'}
                    },
                    func: 'get_joint_6'
                },
                {
                    opcode: 'getJoint7',
                    blockType: BlockType.REPORTER,
                    text: 'joint 7 [DATA]',
                    arguments: {
                        DATA: {type: ArgumentType.STRING, menu: 'dexJoint7Data', defaultValue: 'position'}
                    },
                    func: 'get_joint_7'
                },
                {
                    opcode: 'opcode',
                    blockType: BlockType.COMMAND,
                    text: 'send raw command [CMD]',
                    arguments: {
                        CMD: {type: ArgumentType.STRING, defaultValue: 'g'}
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
        var self = this;
        function onClose (evt) {
            console.log('closed');
            try {
                if (self._ws && evt.code != 1006) {
                    self.newSock();
                } else {
                    console.log('disconnected (1006)');
                }
            } catch (e) {
                console.log('disconnected');
                self._ws = null;
            }
        };
        function onData (msg) {
            self._status = new DataView(msg.data);
            console.log(self.get_last_oplet() + ' errored: ' + self.get_last_errored());
        };
        function onOpen () {
            console.log('connected, this =', this);
            self.get_robot_status();
        };
        this._ws = new WebSocket('ws://localhost:3000');
        this._ws.addEventListener('close', onClose);
        this._ws.addEventListener('message', onData);
        this._ws.addEventListener('open', onOpen);
        this._ws.binaryType = 'arraybuffer';
    }

    checkSock () {
        if (this._ws) return;
        this.newSock();
    }

    get_robot_status () {
        console.log('g');
        this.checkSock();
        this._ws.send('1 ' + (this._count++) + ' 1 undefined g ;');
    }

    get_last_oplet () {
        return String.fromCharCode(this._status.getInt32(4 * 4, true));
    }

    get_last_errored () {
        return this._status.getInt32(5 * 4, true) > 0;
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

    get_last (args) {
        return this._status.getInt32({
            'job number': 0,
            'instruction number': 1,
            'start time': 2,
            'end time': 3
        }[args.THING] * 4, true);
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
