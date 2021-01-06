module es {
    export enum PointSectors {
        center = 0,
        top = 1,
        bottom = 2,
        topLeft = 9,
        topRight = 5,
        left = 8,
        right = 4,
        bottomLeft = 10,
        bottomRight = 6
    }

    export class Collisions {
        public static lineToLine(a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2): boolean {
            let b = Vector2.subtract(a2, a1);
            let d = Vector2.subtract(b2, b1);
            let bDotDPerp = b.x * d.y - b.y * d.x;

            // 如果b*d = 0，表示这两条直线平行，因此有无穷个交点
            if (bDotDPerp == 0)
                return false;

            let c = Vector2.subtract(b1, a1);
            let t = (c.x * d.y - c.y * d.x) / bDotDPerp;
            if (t < 0 || t > 1)
                return false;

            let u = (c.x * b.y - c.y * b.x) / bDotDPerp;
            if (u < 0 || u > 1)
                return false;

            return true;
        }

        public static lineToLineIntersection(a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2, intersection: Vector2 = new Vector2()): boolean {
            intersection.x = 0;
            intersection.y = 0;

            let b = Vector2.subtract(a2, a1);
            let d = Vector2.subtract(b2, b1);
            let bDotDPerp = b.x * d.y - b.y * d.x;

            // 如果b*d = 0，表示这两条直线平行，因此有无穷个交点
            if (bDotDPerp == 0)
                return false;

            let c = Vector2.subtract(b1, a1);
            let t = (c.x * d.y - c.y * d.x) / bDotDPerp;
            if (t < 0 || t > 1)
                return false;

            let u = (c.x * b.y - c.y * b.x) / bDotDPerp;
            if (u < 0 || u > 1)
                return false;

            let temp = Vector2.add(a1, new Vector2(t * b.x, t * b.y));
            intersection.x = temp.x;
            intersection.y = temp.y;

            return true;
        }

        public static closestPointOnLine(lineA: Vector2, lineB: Vector2, closestTo: Vector2) {
            let v = Vector2.subtract(lineB, lineA);
            let w = Vector2.subtract(closestTo, lineA);
            let t = Vector2.dot(w, v) / Vector2.dot(v, v);
            t = MathHelper.clamp(t, 0, 1);

            return Vector2.add(lineA, new Vector2(v.x * t, v.y * t));
        }

        public static circleToCircle(circleCenter1: Vector2, circleRadius1: number, circleCenter2: Vector2, circleRadius2: number): boolean {
            return Vector2.distanceSquared(circleCenter1, circleCenter2) < (circleRadius1 + circleRadius2) * (circleRadius1 + circleRadius2);
        }

        public static circleToLine(circleCenter: Vector2, radius: number, lineFrom: Vector2, lineTo: Vector2): boolean {
            return Vector2.distanceSquared(circleCenter, this.closestPointOnLine(lineFrom, lineTo, circleCenter)) < radius * radius;
        }

        public static circleToPoint(circleCenter: Vector2, radius: number, point: Vector2): boolean {
            return Vector2.distanceSquared(circleCenter, point) < radius * radius;
        }

        public static rectToCircle(rect: Rectangle, cPosition: Vector2, cRadius: number): boolean {
            // 检查矩形是否包含圆的中心点
            if (this.rectToPoint(rect.x, rect.y, rect.width, rect.height, cPosition))
                return true;

            // 对照相关边缘检查圆圈
            let edgeFrom: Vector2;
            let edgeTo: Vector2;
            let sector = this.getSector(rect.x, rect.y, rect.width, rect.height, cPosition);

            if ((sector & PointSectors.top) != 0){
                edgeFrom = new Vector2(rect.x, rect.y);
                edgeTo = new Vector2(rect.x + rect.width, rect.y);
                if (this.circleToLine(cPosition, cRadius, edgeFrom, edgeTo))
                    return true;
            }

            if ((sector & PointSectors.bottom) != 0){
                edgeFrom = new Vector2(rect.x, rect.y + rect.width);
                edgeTo = new Vector2(rect.x + rect.width, rect.y + rect.height);
                if (this.circleToLine(cPosition, cRadius, edgeFrom, edgeTo))
                    return true;
            }

            if ((sector & PointSectors.left) != 0){
                edgeFrom = new Vector2(rect.x, rect.y);
                edgeTo = new Vector2(rect.x, rect.y + rect.height);
                if (this.circleToLine(cPosition, cRadius, edgeFrom, edgeTo))
                    return true;
            }

            if ((sector & PointSectors.right) != 0) {
                edgeFrom = new Vector2(rect.x + rect.width, rect.y);
                edgeTo = new Vector2(rect.x + rect.width, rect.y + rect.height);
                if (this.circleToLine(cPosition, cRadius, edgeFrom, edgeTo))
                    return true;
            }

            return false;
        }

        public static rectToLine(rect: Rectangle, lineFrom: Vector2, lineTo: Vector2) {
            let fromSector = this.getSector(rect.x, rect.y, rect.width, rect.height, lineFrom);
            let toSector = this.getSector(rect.x, rect.y, rect.width, rect.height, lineTo);

            if (fromSector == PointSectors.center || toSector == PointSectors.center) {
                return true;
            } else if ((fromSector & toSector) != 0) {
                return false;
            } else {
                let both = fromSector | toSector;
                // 线对边进行检查
                let edgeFrom: Vector2;
                let edgeTo: Vector2;

                if ((both & PointSectors.top) != 0) {
                    edgeFrom = new Vector2(rect.x, rect.y);
                    edgeTo = new Vector2(rect.x + rect.width, rect.y);
                    if (this.lineToLine(edgeFrom, edgeTo, lineFrom, lineTo))
                        return true;
                }

                if ((both & PointSectors.bottom) != 0) {
                    edgeFrom = new Vector2(rect.x, rect.y + rect.height);
                    edgeTo = new Vector2(rect.x + rect.width, rect.y + rect.height);
                    if (this.lineToLine(edgeFrom, edgeTo, lineFrom, lineTo))
                        return true;
                }

                if ((both & PointSectors.left) != 0) {
                    edgeFrom = new Vector2(rect.x, rect.y);
                    edgeTo = new Vector2(rect.x, rect.y + rect.height);
                    if (this.lineToLine(edgeFrom, edgeTo, lineFrom, lineTo))
                        return true;
                }

                if ((both & PointSectors.right) != 0) {
                    edgeFrom = new Vector2(rect.x + rect.width, rect.y);
                    edgeTo = new Vector2(rect.x + rect.width, rect.y + rect.height);
                    if (this.lineToLine(edgeFrom, edgeTo, lineFrom, lineTo))
                        return true;
                }
            }

            return false;
        }

        public static rectToPoint(rX: number, rY: number, rW: number, rH: number, point: Vector2) {
            return point.x >= rX && point.y >= rY && point.x < rX + rW && point.y < rY + rH;
        }

        /**
         * 位标志和帮助使用Cohen–Sutherland算法
         *
         * 位标志:
         * 1001 1000 1010
         * 0001 0000 0010
         * 0101 0100 0110
         * @param rX
         * @param rY
         * @param rW
         * @param rH
         * @param point
         */
        public static getSector(rX: number, rY: number, rW: number, rH: number, point: Vector2): PointSectors {
            let sector = PointSectors.center;

            if (point.x < rX)
                sector |= PointSectors.left;
            else if (point.x >= rX + rW)
                sector |= PointSectors.right;

            if (point.y < rY)
                sector |= PointSectors.top;
            else if (point.y >= rY + rH)
                sector |= PointSectors.bottom;

            return sector;
        }
    }
}
