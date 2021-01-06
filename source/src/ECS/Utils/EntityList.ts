module es {
    export class EntityList {
        public scene: Scene;
        /**
         * 场景中添加的实体列表
         */
        public _entities: Entity[] = [];
        /**
         * 本帧添加的实体列表。用于对实体进行分组，以便我们可以同时处理它们
         */
        public _entitiesToAdded: HashSet<Entity> = new HashSet<Entity>();
        /**
         * 本帧被标记为删除的实体列表。用于对实体进行分组，以便我们可以同时处理它们
         */
        public _entitiesToRemove: HashSet<Entity> = new HashSet<Entity>();
        /**
         * 标志，用于确定我们是否需要在这一帧中对实体进行排序
         */
        public _isEntityListUnsorted: boolean;
        /**
         * 通过标签跟踪实体，便于检索
         */
        public _entityDict: Map<number, Entity[]> = new Map<number, Entity[]>();
        public _unsortedTags: Set<number> = new Set<number>();

        constructor(scene: Scene) {
            this.scene = scene;
        }

        public get count() {
            return this._entities.length;
        }

        public get buffer() {
            return this._entities;
        }

        public markEntityListUnsorted() {
            this._isEntityListUnsorted = true;
        }

        public markTagUnsorted(tag: number) {
            this._unsortedTags.add(tag);
        }

        /**
         * 将一个实体添加到列表中。所有的生命周期方法将在下一帧中被调用
         * @param entity
         */
        public add(entity: Entity) {
            this._entitiesToAdded.add(entity);
        }

        /**
         * 从列表中删除一个实体。所有的生命周期方法将在下一帧中被调用
         * @param entity
         */
        public remove(entity: Entity) {
            if (!this._entitiesToRemove.contains(entity)) {
                console.warn(`您正在尝试删除已经删除的实体(${entity.name})`);
                return;
            }

            // 防止在同一帧中添加或删除实体
            if (this._entitiesToAdded.contains(entity)) {
                this._entitiesToAdded.remove(entity);
                return;
            }

            if (!this._entitiesToRemove.contains(entity))
                this._entitiesToRemove.add(entity);
        }

        /**
         * 从实体列表中删除所有实体
         */
        public removeAllEntities() {
            this._unsortedTags.clear();
            this._entitiesToAdded.clear();
            this._isEntityListUnsorted = false;

            // 为什么我们要在这里更新列表？主要是为了处理在场景切换前被分离的实体。
            // 它们仍然会在_entitiesToRemove列表中，这将由updateLists处理。
            this.updateLists();

            for (let i = 0; i < this._entities.length; i++) {
                this._entities[i]._isDestroyed = true;
                this._entities[i].onRemovedFromScene();
                this._entities[i].scene = null;
            }

            this._entities.length = 0;
            this._entityDict.clear();
        }

        /**
         * 检查实体目前是否由这个EntityList管理
         * @param entity
         */
        public contains(entity: Entity): boolean {
            return new linq.List(this._entities).contains(entity) || this._entitiesToAdded.contains(entity);
        }

        public getTagList(tag: number) {
            let list = this._entityDict.get(tag);
            if (!list) {
                list = [];
                this._entityDict.set(tag, list);
            }

            return list;
        }

        public addToTagList(entity: Entity) {
            let list = this.getTagList(entity.tag);
            if (list.findIndex(e => e.id == entity.id) == -1) {
                list.push(entity);
                this._unsortedTags.add(entity.tag);
            }
        }

        public removeFromTagList(entity: Entity) {
            let list = this._entityDict.get(entity.tag);
            if (list) {
                new linq.List(list).remove(entity);
            }
        }

        public update() {
            for (let entity of this._entities) {
                if (entity.enabled && (entity.updateInterval == 1 || Time.frameCount % entity.updateInterval == 0))
                    entity.update();
            }
        }

        public updateLists() {
            if (this._entitiesToRemove.getCount() > 0) {
                this._entitiesToRemove.toArray().forEach(entity => {
                    // 处理标签列表
                    this.removeFromTagList(entity);

                    // 处理常规实体列表
                    new linq.List(this._entities).remove(entity);
                    entity.onRemovedFromScene();
                    entity.scene = null;

                    this.scene.entityProcessors.onEntityRemoved(entity);
                });
                this._entitiesToRemove.clear();
            }

            if (this._entitiesToAdded.getCount() > 0) {
                this._entitiesToAdded.toArray().forEach(entity => {
                    this._entities.push(entity);
                    entity.scene = this.scene;

                    this.addToTagList(entity);

                    this.scene.entityProcessors.onEntityAdded(entity);
                });

                this._entitiesToAdded.toArray().forEach(entity => {
                    entity.onAddedToScene();
                })

                this._entitiesToAdded.clear();
                this._isEntityListUnsorted = true;
            }

            if (this._isEntityListUnsorted) {
                this._entities.sort(Entity.entityComparer.compare);
                this._isEntityListUnsorted = false;
            }

            // 根据需要对标签列表进行排序
            if (this._unsortedTags.size > 0) {
                this._unsortedTags.forEach(value => this._entityDict.get(value).sort((a, b) => a.compareTo(b)));

                this._unsortedTags.clear();
            }
        }

        /**
         * 返回第一个找到的名字为name的实体。如果没有找到则返回null
         * @param name
         */
        public findEntity(name: string) {
            for (let i = 0; i < this._entities.length; i++) {
                if (this._entities[i].name == name)
                    return this._entities[i];
            }

            for (let i = 0; i < this._entitiesToAdded.getCount(); i++) {
                let entity = this._entitiesToAdded.toArray()[i];
                if (entity.name == name)
                    return entity;
            }

            return null;
        }

        /**
         * 返回带有标签的所有实体的列表。如果没有实体有标签，则返回一个空列表。
         * 返回的List可以通过ListPool.free放回池中
         * @param tag
         */
        public entitiesWithTag(tag: number) {
            let list = this.getTagList(tag);

            let returnList = ListPool.obtain<Entity>();
            returnList.length = this._entities.length;
            for (let i = 0; i < list.length; i++)
                returnList.push(list[i]);

            return returnList;
        }

        /**
         * 返回一个T类型的所有实体的列表。
         * 返回的List可以通过ListPool.free放回池中。
         * @param type
         */
        public entitiesOfType<T extends Entity>(type): T[] {
            let list = ListPool.obtain<T>();
            for (let i = 0; i < this._entities.length; i++) {
                if (this._entities[i] instanceof type)
                    list.push(this._entities[i] as T);
            }

            for (let i = 0; i < this._entitiesToAdded.getCount(); i++) {
                let entity = this._entitiesToAdded.toArray()[i];
                if (TypeUtils.getType(entity) instanceof type) {
                    list.push(entity as T);
                }
            }

            return list;
        }

        /**
         * 返回在场景中找到的第一个T类型的组件。
         * @param type
         */
        public findComponentOfType<T extends Component>(type): T {
            for (let i = 0; i < this._entities.length; i++) {
                if (this._entities[i].enabled) {
                    let comp = this._entities[i].getComponent<T>(type);
                    if (comp)
                        return comp;
                }
            }

            for (let i = 0; i < this._entitiesToAdded.getCount(); i++) {
                let entity: Entity = this._entitiesToAdded.toArray()[i];
                if (entity.enabled) {
                    let comp = entity.getComponent<T>(type);
                    if (comp)
                        return comp;
                }
            }

            return null;
        }

        /**
         * 返回在场景中找到的所有T类型的组件。
         * 返回的List可以通过ListPool.free放回池中。
         * @param type
         */
        public findComponentsOfType<T extends Component>(type): T[] {
            let comps = ListPool.obtain<T>();
            for (let i = 0; i < this._entities.length; i++) {
                if (this._entities[i].enabled)
                    this._entities[i].getComponents(type, comps);
            }

            for (let i = 0; i < this._entitiesToAdded.getCount(); i++) {
                let entity = this._entitiesToAdded.toArray()[i];
                if (entity.enabled)
                    entity.getComponents(type, comps);
            }

            return comps;
        }
    }
}
