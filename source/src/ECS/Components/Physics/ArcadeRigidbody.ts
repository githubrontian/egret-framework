module es {
    /**
     * 请注意，这不是一个完整的、多迭代的物理系统！它可以用于简单的、街机风格的物理。
     * 这可以用于简单的，街机风格的物理学
     */
    export class ArcadeRigidbody extends Component implements IUpdatable {
        /** 这个刚体的质量。质量为0，则是一个不可移动的物体 */
        public get mass(){
            return this._mass;
        }

        public set mass(value: number){
            this.setMass(value);
        }

        /**
         * 0-1范围，其中0为无反弹，1为完全反射。
         */
        public get elasticity() {
            return this._elasticity;
        }

        public set elasticiy(value: number){
            this.setElasticity(value);
        }

        /**
         * 0 - 1范围。0表示没有摩擦力，1表示物体会停止在原地
         */
        public get friction(){
            return this._friction;
        }

        public set friction(value: number){
            this.setFriction(value);
        }

        /**
         * 0-9的范围。当发生碰撞时，沿碰撞面做直线运动时，如果其平方幅度小于glue摩擦力，则将碰撞设置为上限
         */
        public get glue() {
            return this._glue;
        }

        public set glue(value: number){
            this.setGlue(value);
        }

        /**
         *  如果为真，则每一帧都会考虑到Physics.gravity
         */
        public shouldUseGravity: boolean = true;

        /**
         * 该刚体的速度
         */
        public velocity: Vector2 = new Vector2();

        /**
         * 质量为0的刚体被认为是不可移动的。改变速度和碰撞对它们没有影响
         */
        public get isImmovable(){
            return this._mass < 0.0001;
        }

        public _mass = 10;
        public _elasticity = 0.5;
        public _friction = 0.5;
        public _glue = 0.01;
        public _inverseMass: number = 0;
        public _collider: Collider;

        constructor(){
            super();
            this._inverseMass = 1 / this._mass;
        }

        /**
         * 这个刚体的质量。质量为0，则是一个不可移动的物体
         * @param mass 
         */
        public setMass(mass: number): ArcadeRigidbody {
            this._mass = MathHelper.clamp(mass, 0, Number.MAX_VALUE);

            if (this._mass > 0.0001)
                this._inverseMass = 1 / this._mass;
            else 
                this._inverseMass = 0;
            return this;
        }

        /**
         * 0-1范围，其中0为无反弹，1为完全反射。
         * @param value 
         */
        public setElasticity(value: number): ArcadeRigidbody {
            this._elasticity = MathHelper.clamp01(value);
            return this;
        }

        /**
         * 0 - 1范围。0表示没有摩擦力，1表示物体会停止在原地
         * @param value 
         */
        public setFriction(value: number): ArcadeRigidbody {
            this._friction = MathHelper.clamp01(value);
            return this;
        }

        /**
         * 0-9的范围。当发生碰撞时，沿碰撞面做直线运动时，如果其平方幅度小于glue摩擦力，则将碰撞设置为上限
         * @param value 
         */
        public setGlue(value: number): ArcadeRigidbody {
            this._glue = MathHelper.clamp(value, 0, 10);
            return this;
        }

        /**
         * 用刚体的质量给刚体加上一个瞬间的力脉冲。力是一个加速度，单位是每秒像素每秒。将力乘以100000，使数值使用更合理
         * @param force 
         */
        public addImpulse(force: Vector2) {
            if (!this.isImmovable) {
                this.velocity = Vector2.add(this.velocity, Vector2.multiply(force, new Vector2(100000))
                    .multiply(new Vector2(this._inverseMass * Time.deltaTime)));
            }
        }

        public onAddedToEntity(){
            this._collider = this.entity.getComponent<es.Collider>(es.Collider);
            if (this._collider == null) {
                console.warn("ArcadeRigidbody 没有 Collider。ArcadeRigidbody需要一个Collider!");
            }
        }

        public update(){
            if (this.isImmovable || this._collider == null) {
                this.velocity = Vector2.zero;
                return;
            }

            if (this.shouldUseGravity)
                this.velocity = Vector2.add(this.velocity, Vector2.multiply(Physics.gravity, new Vector2(Time.deltaTime)));

            this.entity.transform.position = Vector2.add(this.entity.transform.position, Vector2.multiply(this.velocity, new Vector2(Time.deltaTime)));
            let collisionResult = new CollisionResult();

            // 捞取我们在新的位置上可能会碰撞到的任何东西
            let neighbors = Physics.boxcastBroadphaseExcludingSelfNonRect(this._collider, this._collider.collidesWithLayers.value);   
            for (let neighbor of neighbors) {
                // 如果邻近的对撞机是同一个实体，则忽略它
                if (neighbor.entity.equals(this.entity)) {
                    continue;
                }

                if (this._collider.collidesWithNonMotion(neighbor, collisionResult)) {
                    // 如果附近有一个ArcadeRigidbody，我们就会处理完整的碰撞响应。如果没有，我们会根据附近是不可移动的来计算事情
                    let neighborRigidbody = neighbor.entity.getComponent<ArcadeRigidbody>(ArcadeRigidbody);
                    if (neighborRigidbody != null) {
                        this.processOverlap(neighborRigidbody, collisionResult.minimumTranslationVector);
                        this.processCollision(neighborRigidbody, collisionResult.minimumTranslationVector);
                    } else {
                        // 没有ArcadeRigidbody，所以我们假设它是不动的，只移动我们自己的
                        this.entity.transform.position = Vector2.subtract(this.entity.transform.position, collisionResult.minimumTranslationVector);
                        let relativeVelocity = this.velocity.clone();
                        this.calculateResponseVelocity(relativeVelocity, collisionResult.minimumTranslationVector, relativeVelocity);
                        this.velocity = Vector2.add(this.velocity, relativeVelocity);
                    }
                }
            }        
        }

        /**
         * 将两个重叠的刚体分开。也处理其中一个不可移动的情况
         * @param other 
         * @param minimumTranslationVector 
         */
        public processOverlap(other: ArcadeRigidbody, minimumTranslationVector: Vector2) {
            if (this.isImmovable) {
                other.entity.transform.position = Vector2.add(other.entity.transform.position, minimumTranslationVector);
            }else if(other.isImmovable) {
                this.entity.transform.position = Vector2.subtract(this.entity.transform.position, minimumTranslationVector);
            } else {
                this.entity.transform.position = Vector2.subtract(this.entity.transform.position, Vector2.multiply(minimumTranslationVector, Vector2Ext.halfVector()));
                other.entity.transform.position = Vector2.add(other.entity.transform.position, Vector2.multiply(minimumTranslationVector, Vector2Ext.halfVector()));
            }
        }

        /**
         * 处理两个非重叠的刚体的碰撞。新的速度将根据情况分配给每个刚体
         * @param other 
         * @param minimumTranslationVector 
         */
        public processCollision(other: ArcadeRigidbody, minimumTranslationVector: Vector2) {
            // 我们计算两个相撞物体的响应。
            // 计算的基础是沿碰撞表面法线反射的物体的相对速度。
            // 然后，响应的一部分会根据质量加到每个物体上
            let relativeVelocity = Vector2.subtract(this.velocity, other.velocity);

            this.calculateResponseVelocity(relativeVelocity, minimumTranslationVector, relativeVelocity);

            // 现在，我们使用质量来线性缩放两个刚体上的响应
            let totalinverseMass = this._inverseMass + other._inverseMass;
            let ourResponseFraction = this._inverseMass / totalinverseMass;
            let otherResponseFraction = other._inverseMass / totalinverseMass;

            this.velocity = Vector2.add(this.velocity, new Vector2(relativeVelocity.x * ourResponseFraction, relativeVelocity.y * ourResponseFraction));
            other.velocity = Vector2.subtract(other.velocity, new Vector2(relativeVelocity.x * otherResponseFraction, relativeVelocity.y * otherResponseFraction));
        }

        /**
         *  给定两个物体和MTV之间的相对速度，本方法修改相对速度，使其成为碰撞响应
         * @param relativeVelocity 
         * @param minimumTranslationVector 
         * @param responseVelocity 
         */
        public calculateResponseVelocity(relativeVelocity: Vector2, minimumTranslationVector: Vector2, responseVelocity: Vector2 = new Vector2()){
            // 首先，我们得到反方向的归一化MTV：表面法线
            let inverseMTV = Vector2.multiply(minimumTranslationVector, new Vector2(-1));
            let normal = Vector2.normalize(inverseMTV);

            // 速度是沿碰撞法线和碰撞平面分解的。
            // 弹性将影响沿法线的响应（法线速度分量），摩擦力将影响速度的切向分量（切向速度分量）
            let n = Vector2.dot(relativeVelocity, normal);

            let normalVelocityComponent = new Vector2(normal.x * n, normal.y * n);
            let tangentialVelocityComponent = Vector2.subtract(relativeVelocity, normalVelocityComponent);

            if (n > 0)
                normalVelocityComponent = Vector2.zero;

            // 如果切向分量的平方幅度小于glue，那么我们就把摩擦力提升到最大
            let coefficientOfFriction = this._friction;
            if (tangentialVelocityComponent.lengthSquared() < this._glue)
                coefficientOfFriction = 1.01;

            // 弹性影响速度的法向分量，摩擦力影响速度的切向分量
            let t = Vector2.multiply(new Vector2((1 + this._elasticity)), normalVelocityComponent)
                .multiply(new Vector2(-1))
                .subtract(Vector2.multiply(new Vector2(coefficientOfFriction), tangentialVelocityComponent));
            responseVelocity.x = t.x;
            relativeVelocity.y = t.y;
        }
    }
}